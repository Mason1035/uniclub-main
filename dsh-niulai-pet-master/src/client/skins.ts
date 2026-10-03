/**
 * 皮肤注册表（兼容层）：角色/皮肤定义已迁至 packs.ts 的两级模型
 * （BUILTIN_PACKS + expandCharacters），本模块保留旧导出形状——
 * pet.ts / card.tsx / demo.ts 的消费面不变。
 * 语音识别模板是引擎资源，独立放 assets/voice/（不属任何角色）。
 * @module dsh-niulai-pet/skins
 */

import replyRef from '../../assets/voice/reply_ref.mp3'
import replyMatch from '../../assets/voice/reply_match.mp3'
import type { SkinDef } from './pet.js'
import { BUILTIN_PACKS, expandCharacters } from './packs.js'

/**
 * 语音识别参考模板（带原片底噪的旧版「牛来！」）：与干净版 reply.mp3 双模板
 * 互补——带噪输入对带噪模板更友好，干净输入对干净模板更准（voice.ts 取 min）。
 */
export const REPLY_REF = replyRef

/** 识别主模板：同一段「牛来！」的长切版（含完整衰减尾，抗短模板被「妈妈」局部强对齐）。仅匹配用，不播放。 */
export const REPLY_MATCH = replyMatch

/** 内置皮肤注册表（= 内置角色包展开；自定义皮肤经 PackRegistry 动态并入）。 */
export const SKINS: SkinDef[] = expandCharacters(BUILTIN_PACKS)

export { BUILTIN_PACKS, expandCharacters, PackRegistry } from './packs.js'
export type { CharacterDef, PackSkinDef, PackVoice, RegistrySnapshot } from './packs.js'
