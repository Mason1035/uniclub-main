/**
 * 设置卡片「点预览图高亮对应桌宠」的瞬时事件总线（card → 各 pet 实例）。
 * 纯 UI 事件，不落配置；多只时各自比对 petId 自认领。
 * @module dsh-niulai-pet/highlight
 */

export class HighlightBus {
  private readonly listeners = new Set<(petId: string) => void>()
  private readonly holdListeners = new Set<(petId: string | null) => void>()
  /** 当前驻留高亮的桌宠（null=无）。 */
  private held: string | null = null

  // 箭头属性形态：消费端以方法引用方式提取，普通 class 方法会丢 this（踩过）
  readonly subscribe = (fn: (petId: string) => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  readonly emit = (petId: string): void => {
    for (const fn of this.listeners) fn(petId)
  }

  /** 驻留高亮（设置卡片「当前桌宠」tab 期间持续发光）：晚订阅者先补一帧当前态。 */
  readonly subscribeHold = (fn: (petId: string | null) => void): (() => void) => {
    this.holdListeners.add(fn)
    fn(this.held)
    return () => { this.holdListeners.delete(fn) }
  }

  readonly setHold = (petId: string | null): void => {
    if (this.held === petId) return
    this.held = petId
    for (const fn of this.holdListeners) fn(petId)
  }

  /** 持有者释放：只清自己持有的那只（防多卡片实例/面板与设置页并存时误清）。 */
  readonly releaseHold = (petId: string): void => {
    if (this.held === petId) this.setHold(null)
  }
}
