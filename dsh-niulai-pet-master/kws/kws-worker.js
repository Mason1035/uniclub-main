/**
 * dsh-niulai-pet KWS worker：在独立线程装载 sherpa-onnx wasm 跑关键词识别。
 *
 * 为什么放 worker：wasm 线性内存只涨不缩，kws.free() 只把对象还给 wasm 堆、
 * 物理内存不归还浏览器——worker.terminate() 是唯一可证明的释放路径
 * （宿主 kws.ts 在零引用空闲 10s 后 terminate，下次监听重建，
 * wasm/HTTP 缓存加持下秒级）。推理顺带挪出主线程。
 *
 * 协议（postMessage）：
 *   → {type:'init', base, q, config}   装载 wasm+模型（importScripts 两件套）
 *   ← {type:'ready'} / {type:'error', message}
 *   → {type:'open', id}                开一条 stream（多路复用：卡片测试与正式监听共存）
 *   → {type:'feed', id, samples}       Float32Array（buffer 经 transfer 零拷贝）
 *   ← {type:'hit', id, keyword}        命中；该 stream 自动 reset 可继续喂
 *   → {type:'close', id}               关 stream
 *   ← {type:'error', message}          运行期错误（decode 异常等）
 */
'use strict'

let kws = null
const streams = new Map()

self.onmessage = (e) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      init(msg)
      return
    }
    if (kws === null) return
    if (msg.type === 'open') {
      streams.set(msg.id, kws.createStream())
      return
    }
    if (msg.type === 'close') {
      const s = streams.get(msg.id)
      if (s !== undefined) {
        kws.reset(s)
        s.free()
        streams.delete(msg.id)
      }
      return
    }
    if (msg.type === 'feed') {
      const s = streams.get(msg.id)
      if (s === undefined) return
      s.acceptWaveform(16000, msg.samples)
      while (kws.isReady(s)) {
        kws.decode(s)
        const r = kws.getResult(s)
        if (r && r.keyword) {
          // 命中即清该 stream 的声学上下文：同一声不重复上报，下一声还能中
          kws.reset(s)
          self.postMessage({ type: 'hit', id: msg.id, keyword: r.keyword })
        }
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.stack) || err) })
  }
}

function init(msg) {
  self.Module = {
    locateFile: (f) => `${msg.base}/${f}${msg.q}`,
    onRuntimeInitialized: () => {
      try {
        self.importScripts(`${msg.base}/sherpa-onnx-kws.js${msg.q}`)
        // eslint-disable-next-line no-undef
        kws = createKws(self.Module, msg.config)
        self.postMessage({ type: 'ready' })
      } catch (err) {
        self.postMessage({ type: 'error', message: String((err && err.stack) || err) })
      }
    },
  }
  self.importScripts(`${msg.base}/sherpa-onnx-wasm-kws-main.js${msg.q}`)
}
