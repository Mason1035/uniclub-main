/** Skin definitions adapted from dsh-niulai-pet/skins.ts and packs.ts.
 * Copyright (c) 2026 whitefirer. MIT License; see public/pet-assets/LICENSE.
 * Additional artwork/audio supplied in new-pets.zip; see NOTICE for asset rights.
 */
import type { PetSkin } from './types';

const asset = (path: string) => `${import.meta.env.BASE_URL}pet-assets/${path}`;
const niulaiVoice = {
  sounds: [asset('niulai/mama1.mp3'), asset('niulai/mama2.mp3')],
  soundDurationsMs: [3500, 3100], voice: null,
} as const;

export const PET_SKINS: readonly PetSkin[] = [
  {
    id: 'panda', name: '熊猫', image: asset('panda/panda.png'), imageBlink: asset('panda/panda_blink.png'),
    voice: 'squeak', signature: 'roll', shoutBubble: '嗯嗯！',
    quips: ['竹子比 bug 好吃', '读书也要休息一下'], defaultSize: 120, aspectRatio: 291 / 312,
  },
  {
    id: 'whale', name: '蓝鲸', image: asset('whale/whale.png'), imageBlink: asset('whale/whale_blink.png'),
    imageSpout: asset('whale/whale_spout.png'), voice: 'whale', signature: 'breach', shoutBubble: '噗——！',
    quips: ['一起游向新知识', '咕嘟咕嘟'], defaultSize: 120, aspectRatio: 367 / 234,
  },
  {
    id: 'niulai', name: '牛来 · 萌化', image: asset('niulai/skins/default/pet.png'),
    imageBlink: asset('niulai/skins/default/pet_blink.png'), imageShout: asset('niulai/skins/default/pet_shout.png'),
    imageFly: asset('niulai/skins/default/pet_fly.png'), imageFlyShout: asset('niulai/skins/default/pet_fly_shout.png'),
    ...niulaiVoice, signature: 'hops', shoutBubble: '妈~~妈~~',
    quips: ['课间一起跳一跳', '今天也要加油呀'], defaultSize: 120, aspectRatio: 155 / 334,
  },
  {
    id: 'orig', name: '牛来 · 原皮', image: asset('niulai/skins/orig/pet_orig.png'),
    imageBlink: asset('niulai/skins/orig/pet_orig_blink.png'), imageShout: asset('niulai/skins/orig/pet_orig_shout.png'),
    ...niulaiVoice, signature: 'hops', shoutBubble: '妈~~妈~~',
    quips: ['在这里陪你学习', '休息一下再出发'], defaultSize: 120, aspectRatio: 299 / 500,
  },
  {
    id: 'young', name: '牛来 · 小黄', image: asset('niulai/skins/young/pet_young.png'),
    imageBlink: asset('niulai/skins/young/pet_young_blink.png'), imageShout: asset('niulai/skins/young/pet_young_shout.png'),
    imageFly: asset('niulai/skins/young/pet_young_fly.png'), imageFlyShout: asset('niulai/skins/young/pet_young_fly_shout.png'),
    ...niulaiVoice, signature: 'roll', shoutBubble: '妈~~',
    quips: ['翻个跟头换换心情', '下一个目标是什么呀'], defaultSize: 120, aspectRatio: 155 / 334,
  },
  {
    id: 'nailong', name: '奶龙', image: asset('nailong/skins/default/nailong.png'),
    imageBlink: asset('nailong/skins/default/nailong_blink.png'), imageShout: asset('nailong/skins/default/nailong_shout.png'),
    shoutAnim: [{ src: asset('nailong/skins/default/nailong_anim.webp'), at: 0 }],
    sounds: [asset('nailong/nailong_laugh.mp3')], soundDurationsMs: [15650],
    voice: null, signature: 'sway', shoutBubble: '哈~哈~',
    quips: ['开心一点，慢慢来', '学习间隙也可以笑一笑'], defaultSize: 155, aspectRatio: 279 / 471,
  },
  {
    id: 'cat', name: '赛博猫', image: asset('cat/skins/default/cat_sleep.webp'),
    imageShout: asset('cat/skins/default/cat.webp'), sounds: [asset('cat/cat_meow.mp3')], soundDurationsMs: [650],
    voice: null, signature: 'sway', shoutBubble: '喵——！',
    quips: ['喵，记得伸个懒腰', '陪你安静看一会儿'], defaultSize: 120, aspectRatio: 462 / 531,
  },
  {
    id: 'dagou', name: '大狗', image: asset('dagou/skins/default/dagou.webp'),
    imageShout: asset('dagou/skins/default/dagou_shout.webp'), sounds: [asset('dagou/dagou_call.mp3')], soundDurationsMs: [2175],
    voice: null, signature: 'hops', shoutBubble: '大狗叫！',
    quips: ['一起精神抖擞地出发', '汪，今天又进步啦'], defaultSize: 120, aspectRatio: 1,
  },
  {
    id: 'xiaonailong', name: '小奶龙', image: asset('xiaonailong/skins/default/xiaonailong.png'),
    imageBlink: asset('xiaonailong/skins/default/xiaonailong_blink.png'),
    shoutAnim: [
      { src: asset('xiaonailong/skins/default/xiaonailong.png'), at: 0 },
      { src: asset('xiaonailong/skins/default/f2.png'), at: 0.15 },
      { src: asset('xiaonailong/skins/default/f3.png'), at: 0.34 },
      { src: asset('xiaonailong/skins/default/f4.png'), at: 0.75 },
    ],
    sounds: [asset('xiaonailong/xiaonailong.mp3')], soundDurationsMs: [2750],
    voice: null, signature: 'sway', shoutBubble: '我是奶龙！',
    quips: ['今天有好消息吗', '小小一步，也很棒'], defaultSize: 100, aspectRatio: 351 / 480,
  },
];

export const findPetSkin = (id: string): PetSkin => PET_SKINS.find(skin => skin.id === id) ?? PET_SKINS[0];
