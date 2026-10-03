/**
 * 桌宠物理碰撞世界：body 注册表 + 单 rAF 循环。
 * 规则刻意简单（地面一维世界 + 高度门槛）：
 * - 重叠即分离（各推一半）——多只在同一地面线上走会互相「挤」；
 *   **垂直方向不搭界就不算碰**（底边离地 + 身高求重叠）：拎着越过头顶不推人
 * - 接近速度过阈触发 bump（小跳/调头）——快走撞上=弹开；飞行落点砸中别只=强 bump（弹飞）
 * - 每只 bump 有冷却，防贴脸抖动
 * 循环只在 ≥2 只注册时运行；全部注销即停。
 * @module dsh-niulai-pet/physics
 */

export interface PhysicsBody {
  id: string
  /** 左缘 x（px）。 */
  getX(): number
  /** 当前渲染宽（帧宽随动作变，活取）。 */
  getW(): number
  /** 底边离地高度（px；被拎起/坠落中 >0，站立 =0）。 */
  getLiftY(): number
  /** 当前身高（px，≈petH）。 */
  getH(): number
  /** 外部改 x（挤压分离用；实现方负责钳位与应用）。 */
  setX(x: number): void
  /** 被撞反应：dir=被推向的方向，strong=重撞（砸落/高速）。 */
  bump(dir: 1 | -1, strong: boolean): void
  /** 正被用户拎着/坠落中：不被分离推动（它只推别人；推着它还手=闪回地面，踩过）。 */
  held(): boolean
}

const bodies = new Map<string, PhysicsBody>()
const prevX = new Map<string, number>()
const lastBump = new Map<string, number>()
let raf = 0

const BUMP_COOLDOWN = 700 // ms
const CLOSING_BUMP = 3 // px/帧 接近速度阈值：慢贴只挤不弹
const CLOSING_STRONG = 9 // 超过算重撞

function tick(): void {
  const list = [...bodies.values()]
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const ax = a.getX()
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      const bx = b.getX()
      const overlap = Math.min(ax + a.getW(), bx + b.getW()) - Math.max(ax, bx)
      // 垂直搭界才算碰：底边离地 + 身高求重叠（拎着越过头顶不推人）
      const vOverlap = Math.min(a.getLiftY() + a.getH(), b.getLiftY() + b.getH())
        - Math.max(a.getLiftY(), b.getLiftY())
      if (overlap > 4 && vOverlap > 0) {
        // 分离：各推一半（a 左 b 右时 dir=1：a 向左、b 向右）；
        // 被拎着的除外——它全推给对方（用户的手最大）
        const dir = ax <= bx ? 1 : -1
        const aHeld = a.held()
        const bHeld = b.held()
        const push = overlap / 2 + 0.5
        if (!aHeld && !bHeld) {
          a.setX(ax - dir * push)
          b.setX(bx + dir * push)
        } else if (aHeld && !bHeld) {
          b.setX(bx + dir * overlap)
        } else if (bHeld && !aHeld) {
          a.setX(ax - dir * overlap)
        }
        if (aHeld || bHeld) {
          prevX.set(b.id, b.getX())
          prevX.set(a.id, a.getX())
          continue // 拎着的一方不吃 bump 判定
        }
        // 接近速度 = 双方本帧位移之和；过阈且双方过冷却才撞
        const va = Math.abs(ax - (prevX.get(a.id) ?? ax))
        const vb = Math.abs(bx - (prevX.get(b.id) ?? bx))
        const closing = va + vb
        const now = performance.now()
        if (closing > CLOSING_BUMP
          && now - (lastBump.get(a.id) ?? 0) > BUMP_COOLDOWN
          && now - (lastBump.get(b.id) ?? 0) > BUMP_COOLDOWN) {
          lastBump.set(a.id, now)
          lastBump.set(b.id, now)
          const strong = closing > CLOSING_STRONG
          a.bump((dir * -1) as 1 | -1, strong)
          b.bump(dir as 1 | -1, strong)
        }
      }
      prevX.set(b.id, bx)
    }
    prevX.set(a.id, ax)
  }
  raf = requestAnimationFrame(tick)
}

function ensureLoop(): void {
  if (bodies.size >= 2 && raf === 0) raf = requestAnimationFrame(tick)
  if (bodies.size < 2 && raf !== 0) {
    cancelAnimationFrame(raf)
    raf = 0
    prevX.clear()
    lastBump.clear()
  }
}

/** 注册 body（物理开关开启时）；返回注销函数。 */
export function registerBody(b: PhysicsBody): () => void {
  bodies.set(b.id, b)
  ensureLoop()
  return () => {
    bodies.delete(b.id)
    prevX.delete(b.id)
    lastBump.delete(b.id)
    ensureLoop()
  }
}

/** 砸落碰撞：x..x+w 砸中别只时对它触发 bump。
 *  与主循环的水平接近速度检测互补——坠落是垂直事件，主循环感知不到。
 *  dropH = 坠落总高度；压在别只头上时强度按**头顶上方落差**算（低处轻放=弱
 *  bump，高处砸下=弹飞）。返回 hit=是否砸中；onHead=水平重叠过窄者 45%
 *  （实打实压头，且对方站在地面）时的逃离方向（-1=左 1=右），未压头为 null。 */
export function impactAt(selfId: string, x: number, w: number, dropH: number): { hit: boolean; onHead: 1 | -1 | null } {
  let hit = false
  let onHead: 1 | -1 | null = null
  for (const b of bodies.values()) {
    if (b.id === selfId) continue
    const overlap = Math.min(x + w, b.getX() + b.getW()) - Math.max(x, b.getX())
    if (overlap > 4) {
      hit = true
      const isHead = b.getLiftY() === 0 && overlap > 0.45 * Math.min(w, b.getW())
      const strong = isHead ? dropH - b.getH() > 160 : dropH > 160
      const dir = x + w / 2 <= b.getX() + b.getW() / 2 ? 1 : -1
      b.bump(dir as 1 | -1, strong)
      if (onHead === null && isHead) onHead = dir === 1 ? -1 : 1 // 压左半边往左滑，反之向右
    }
  }
  return { hit, onHead }
}
