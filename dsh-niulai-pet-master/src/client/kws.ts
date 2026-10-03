/**
 * KWS 引擎：sherpa-onnx zipformer（wenetspeech-3.3M，int8 三件套）的 wasm 移植，
 * 真语音识别模型，判别力远超模板匹配（MFCC+DTW）。
 *
 * 架构（2026-08-21 v2，worker 化）：识别跑在 Web Worker 里（kws/kws-worker.js），
 * 主线程经 postMessage 多路复用（stream id）——卡片测试与正式监听可共存。
 * 为什么放 worker：wasm 线性内存（INITIAL_MEMORY=100MB，ALLOW_MEMORY_GROWTH）
 * 只涨不缩，free 只还对象不还物理内存；**worker.terminate() 是唯一可证明的
 * 释放路径**——零引用空闲 IDLE_TEARDOWN_MS 后 terminate，下次监听重建
 * （wasm/HTTP 缓存加持秒级），推理顺带挪出主线程。
 *
 * 资产（loader 80K + wasm 12M + int8 模型 data 4.8M + glue 9.7K + worker）随
 * npm 包分发，由 host 半注册的 /niulai-kws/<file> 路由同源伺服（?v=<插件版本>
 * 破缓存，长缓存）。装载失败（老 dsh 无 webServer、worker 被 CSP 拦等）抛给
 * 调用方回落模板引擎。
 * @module dsh-niulai-pet/kws
 */

/**
 * 指令词预设表（sherpa keywords 行：音素序列 @词，变体 @词+字母后缀，
 * 命中上报变体文本、按前缀归并显示）。每条预设的音素变体都经
 * /tmp/niulai-stt/kws-multi-test.js 离线标定：四词共存时各词 TTS 正样本
 * 命中自身、零串词，妈妈喊声/静音/白噪/他人语音/歌声零误报
 * （已知限制：重口音/超速语音会漏检，声调/鼻音变体猜修无效，不堆；
 * 用户换个自己喊着顺的词即可）。加新词 = 这里加一条 + 重新跑交叉验证。
 */
export interface KwsKeywordPreset {
  id: string
  /** 显示名（也是 @ 输出词的前缀）。 */
  label: string
  /** sherpa keywords 行（多行：主词 + 发音变体）。 */
  lines: string
}

export const KWS_KEYWORD_PRESETS: readonly KwsKeywordPreset[] = [
  {
    id: 'niulai',
    label: '牛来',
    lines: 'n iú l ái @牛来\nn ǐ y òu l ái @牛来A\nn ǐ y ǒu l ái @牛来B\nn iú y òu l ái @牛来C',
  },
  {
    id: 'biehanle',
    label: '别喊了',
    lines: 'b ié h ǎn l e @别喊了\nb ié h ǎn l a @别喊了A',
  },
  {
    id: 'anjing',
    label: '安静',
    lines: 'ān j ìng @安静\nān j īng @安静A',
  },
  {
    id: 'tingxia',
    label: '停下',
    lines: 't íng x ià @停下\nt íng x iā @停下A',
  },
]

/** 启用词 id 列表 → sherpa keywords 内联串（空列表回落「牛来」——至少得有一个词）。 */
export function kwsKeywordsKey(ids: readonly string[]): string {
  const lines = KWS_KEYWORD_PRESETS.filter((p) => ids.includes(p.id)).map((p) => p.lines)
  return lines.length > 0 ? lines.join('\n') : KWS_KEYWORD_PRESETS[0].lines
}

/** 命中上报文本（@词 / @词A）→ 预设显示名；匹配不上原样返回。 */
export function kwsKeywordLabel(keyword: string): string {
  const hit = KWS_KEYWORD_PRESETS.find((p) => keyword.startsWith(p.label))
  return hit?.label ?? keyword
}

/** host 半静态路由前缀（见 index.js serveKws）。 */
const KWS_BASE = '/niulai-kws'

/** 零引用空闲这么久就 terminate worker（重启链——改配置/测试重布防——毫秒级
 *  完成不会被它打断；重建走浏览器缓存秒级）。 */
const IDLE_TEARDOWN_MS = 10_000

/** worker init 超时（首次要拉 17MB + wasm 编译 + 建模，宽限）。 */
const INIT_TIMEOUT_MS = 60_000

// ---- worker 单例池（按关键词串 keyed；引用计数 + 空闲 terminate）----

interface WorkerMsg {
  type?: string
  id?: number
  keyword?: string
  message?: string
}

interface KwsPool {
  key: string
  worker: Worker
  ready: Promise<void>
  refs: number
  teardownTimer: number
}

let pool: KwsPool | null = null
let nextStreamId = 1

function teardownPool(p: KwsPool): void {
  window.clearTimeout(p.teardownTimer)
  p.worker.terminate()
  if (pool === p) pool = null
  console.log('[dsh-niulai-pet] kws worker terminated (idle)')
}

function kwsConfig(keywords: string): unknown {
  return {
    featConfig: { samplingRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: './encoder-epoch-99-avg-1-chunk-16-left-64.int8.onnx',
        decoder: './decoder-epoch-99-avg-1-chunk-16-left-64.int8.onnx',
        joiner: './joiner-epoch-99-avg-1-chunk-16-left-64.int8.onnx',
      },
      tokens: './tokens.txt',
      provider: 'cpu',
      numThreads: 1,
      debug: 0,
    },
    maxActivePaths: 4,
    numTrailingBlanks: 1,
    keywordsScore: 1.5,
    keywordsThreshold: 0.1,
    keywords,
  }
}

function acquire(key: string): KwsPool {
  if (pool !== null && pool.key === key) {
    window.clearTimeout(pool.teardownTimer)
    return pool
  }
  // 换关键词：旧 worker 直接拆（调用方保证旧监听已 destroy——pet 重启链先做）
  if (pool !== null) teardownPool(pool)
  const q = `?v=${__NIULAI_VERSION__}`
  const worker = new Worker(`${KWS_BASE}/kws-worker.js${q}`)
  const p: KwsPool = { key, worker, refs: 0, teardownTimer: 0, ready: Promise.resolve() }
  p.ready = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { reject(new Error('kws worker init timeout')) }, INIT_TIMEOUT_MS)
    const onMsg = (e: MessageEvent): void => {
      const msg = e.data as WorkerMsg
      if (msg.type === 'ready') {
        window.clearTimeout(timer)
        resolve()
      } else if (msg.type === 'error') {
        window.clearTimeout(timer)
        reject(new Error(msg.message ?? 'kws worker init error'))
      }
    }
    const onErr = (ev: ErrorEvent): void => {
      window.clearTimeout(timer)
      reject(new Error(ev.message ?? 'kws worker failed to load'))
    }
    worker.addEventListener('message', onMsg, { once: true })
    worker.addEventListener('error', onErr, { once: true })
    worker.postMessage({ type: 'init', base: KWS_BASE, q, config: kwsConfig(key) })
  })
  p.ready.catch(() => {
    if (pool === p) teardownPool(p)
  })
  pool = p
  return p
}

/** createKwsMatcher 的返回面（与 voice.ts 的 ChunkMatcher 同形）。 */
export interface KwsMatcherHandle {
  /** 喂 16k PCM 块（buffer 经 transfer 零拷贝进 worker——喂出后调用方不得再用）。 */
  feed(chunk: Float32Array): void
  /** 关 stream 并归还引用（最后一个引用触发空闲 terminate 倒计时），幂等。 */
  destroy(): void
}

/**
 * 开一条 KWS 监听（worker 懒装载 + 多路复用；命中回调一次，参数 = 关键词
 * 文本，显示用 kwsKeywordLabel 归并）。装载失败 reject（调用方回落模板）。
 */
export async function createKwsMatcher(keywordsKey: string, onHit: (keyword: string) => void): Promise<KwsMatcherHandle> {
  const p = acquire(keywordsKey)
  p.refs++
  try {
    await p.ready
  } catch (err) {
    p.refs--
    throw err
  }
  const id = nextStreamId++
  let fired = false
  let closed = false
  const onMsg = (e: MessageEvent): void => {
    const msg = e.data as WorkerMsg
    if (msg.type === 'hit' && msg.id === id && !fired) {
      fired = true
      console.log(`[dsh-niulai-pet] voice-stop matched by kws (${msg.keyword ?? ''})`)
      onHit(msg.keyword ?? '')
    }
  }
  p.worker.addEventListener('message', onMsg)
  p.worker.postMessage({ type: 'open', id })
  const destroy = (): void => {
    if (closed) return
    closed = true
    p.worker.removeEventListener('message', onMsg)
    try {
      p.worker.postMessage({ type: 'close', id })
    } catch { /* worker 可能已 terminate，不挡 */ }
    p.refs--
    if (p.refs <= 0 && pool === p) {
      p.teardownTimer = window.setTimeout(() => { teardownPool(p) }, IDLE_TEARDOWN_MS)
    }
  }
  return {
    feed(chunk: Float32Array): void {
      if (fired || closed) return
      p.worker.postMessage({ type: 'feed', id, samples: chunk }, [chunk.buffer])
    },
    destroy,
  }
}
