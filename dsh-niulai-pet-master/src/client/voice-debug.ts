/**
 * 语音停喊的调试状态总线：pet（识别侧）发布、设置卡片（展示侧）订阅。
 * 独立小模块，避免 pet ↔ card 互相 import。
 * @module dsh-niulai-pet/voice-debug
 */

export interface VoiceDebugState {
  /** 正在开麦监听（循环喊进行中且语音开关开）。 */
  listening: boolean
  /** 最近一次识别分（越小越像「牛来」；null = 还没评过）。 */
  lastScore: number | null
  /** 最近一次命中时间戳（ms；null = 没命中过）。 */
  matchedAt: number | null
}

export class VoiceDebugBus {
  private state: VoiceDebugState = { listening: false, lastScore: null, matchedAt: null }
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): VoiceDebugState => this.state

  // 箭头函数字段（非原型方法）：卡片侧以 `bus.subscribe` 引用形式交给
  // useSyncExternalStore，原型方法会丢 this 崩掉（踩过：card 整卡消失）
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  publish(patch: Partial<VoiceDebugState>): void {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }
}
