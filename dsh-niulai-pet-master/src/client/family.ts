/**
 * 全家福列队：阵容常量 + 排布算法（demo 试玩页与 dsh 插件入口共用）。
 * 两种排布：uniform=均匀列队（牛来 C 位、奶龙 ±1、小奶龙 ±2 对称）；
 * layered=层次合影（高个靠中后排、矮个两翼前压，叠压出前后空间感）。
 * @module dsh-niulai-pet/family
 */

import type { PetHandle } from './pet.js'

/** 均匀列队左翼（左→右书写，靠中在前）。 */
export const FAMILY_LEFT = ['panda', 'dagou', 'orig', 'xiaonailong', 'nailong']
/** 均匀列队右翼（左→右书写，靠中在前）。 */
export const FAMILY_RIGHT = ['nailong', 'xiaonailong', 'young', 'cat', 'whale']
/** 层次合影两翼（数组序=绘制序=中心向外：后挂的压先挂的）——奶龙贴 C 位，小奶龙最外两侧；
 *  趴睡猫贴地矮个，排翼列后段（后绘制压前）相当于蹲前排，免得被邻居整个埋掉。 */
export const FAMILY_LAYERED_WINGS = ['nailong', 'nailong', 'young', 'orig', 'panda', 'dagou', 'cat', 'whale', 'xiaonailong', 'xiaonailong']

/** 均匀列队摆位：整体页面居中、28px 紧凑间距。members 按左→右。 */
export function layoutUniform(members: PetHandle[]): void {
  const gap = 28
  const widths = members.map((h) => h.bounds().w)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (members.length - 1)
  let x = Math.max(16, Math.min(window.innerWidth / 2 - total / 2, window.innerWidth - 16 - total))
  for (let i = 0; i < members.length; i++) {
    members[i].place(Math.round(x))
    x += widths[i] + gap
  }
}

/** 层次合影摆位：members[0] 为 C 位（牛来），向外逐只 24% 叠压铺开；
 *  调用方保证 members 顺序 = 绘制顺序（中心在前，叠压者后挂才能压上来）。 */
export function layoutLayered(members: PetHandle[]): void {
  const OVER = 0.24
  const widths = members.map((h) => h.bounds().w)
  const total = widths[0] + widths.slice(1).reduce((a, w) => a + w * (1 - OVER), 0)
  const cx = Math.max(16 + total / 2, Math.min(window.innerWidth / 2, window.innerWidth - 16 - total / 2))
  members[0].place(Math.round(cx - widths[0] / 2))
  let leftEdge = cx - widths[0] / 2
  let rightEdge = cx + widths[0] / 2
  for (let k = 1; k < members.length; k++) {
    const w = widths[k]
    if (k % 2 === 1) { // 左翼：右缘叠进前一只
      const x = leftEdge - w * (1 - OVER)
      members[k].place(Math.round(x))
      leftEdge = x
    } else { // 右翼：左缘叠进前一只
      const x = rightEdge - w * OVER
      members[k].place(Math.round(x))
      rightEdge = x + w
    }
  }
}
