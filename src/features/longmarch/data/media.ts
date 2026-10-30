import type { MarchImage } from './types';

const editorialUse = '教学研究展示引用，保留发布机构、图注与水印。原页面未标注开放许可，版权归摄影者及相关权利人；不视为获得自由商用或进一步转载授权。';
const museumUse = '中国国家博物馆发布的文物照片，供本课题学习研究引用并保留来源。原页未标注开放许可，图片及藏品相关权利归相应权利人。';

function photo(id: string, caption: string, sourceUrl: string, credit: string, type: MarchImage['type'] = '当代遗址照片'): MarchImage {
  return { src: `/temp/media/${id}.webp`, alt: caption, caption, sourceUrl, credit, type, usage: editorialUse };
}

/** Photos are locally stored full-frame reproductions; they are not 1930s field images. */
export const eventMedia: Partial<Record<string, MarchImage>> = {
  departure: photo('yudu', '江西于都县长征渡口。当代遗址照片，非1934年现场影像。', 'https://www.12371.cn/2021/05/16/ARTI1621135287831446.shtml', '新华社记者周密摄；共产党员网转载求是'),
  yudu: photo('yudu', '江西于都县长征渡口。当代遗址照片，非1934年现场影像。', 'https://www.12371.cn/2021/05/16/ARTI1621135287831446.shtml', '新华社记者周密摄；共产党员网转载求是'),
  xiangjiang: photo('xiangjiang', '广西兴安县界首渡口。当代遗址照片，2021年报道所配图。', 'https://www.12371.cn/2021/04/26/ARTI1619391592928105.shtml', '总台央广记者潘毅摄；共产党员网'),
  zunyi: photo('zunyi', '2026年9月28日，修缮一新的贵州遵义会议会址（无人机照片）。当代遗址建筑照片，非1935年会议现场影像。', 'https://www.news.cn/photo/20260928/5bc2e82fc8964de7813ec18d14cd392c/c.html', '新华社记者杨文斌摄'),
  chishui: photo('chishui', '2021年2月23日，红军四渡赤水之一的土城渡口（无人机照片）。', 'https://www.xinhuanet.com/2021-05/13/c_1127440909.htm', '新华社记者刘续摄'),
  jinsha: photo('jinsha', '金沙江皎平渡口。当代遗址照片，非1935年现场影像。', 'https://www.12371.cn/2023/08/20/ARTI1692495372136387.shtml', '保密观／共产党员网；原页未单独标注摄影者'),
  yihai: photo('yihai', '2026年5月13日，四川冕宁县彝海结盟纪念碑（前）和纪念馆（无人机照片）。', 'https://www.news.cn/photo/20260522/cebb4d1a1b8d4152b4054b06a5136efe/c.html', '新华社记者王曦摄'),
  dadu: photo('dadu', '2026年10月16日，四川安顺场红军强渡大渡河遗址上的纪念雕塑。此图为当代雕塑照片，雕塑作者原页未注明。', 'https://www.news.cn/photo/20261017/2f70d04724c9491daf2e161105b86a1d/c.html', '新华社发，兰红光摄', '美术作品'),
  luding: photo('luding', '2026年5月19日，从东桥头拍摄的泸定桥（无人机照片）。', 'https://www.xinhuanet.com/photo/20260529/1a4957f37f7a4da89ea0002029331d48/c.html', '新华社记者胥冰洁摄'),
  jiajin: photo('jiajin', '2024年12月25日，四川夹金山云海（无人机照片）。当代环境影像，非长征时期照片。', 'https://www.xinhuanet.com/photo/20241225/e0acffac5c2e4b4eb9646784c4024583/c.html', '新华社记者王曦摄', '当代环境照片'),
  maogong: photo('maogong', '2026年6月1日，四川小金县达维会师纪念碑（无人机照片）。', 'https://www.news.cn/politics/20260612/f4cc858a9a994d39a0bb58043bf9817a/c.html', '新华社记者王曦摄'),
  grassland: photo('grassland', '2026年8月13日，四川红原县日干乔湿地的红军过草地纪念碑（无人机照片）。', 'https://www.news.cn/photo/20261018/0f4bbb21bbf14ba8a14b6299b6ba75a9/c.html', '新华社记者王曦摄'),
  lazikou: photo('lazikou', '2026年10月13日，甘肃迭部县天险腊子口（无人机照片）。当代遗址环境，非1935年战斗影像。', 'https://www.gs.xinhua.org/20261014/bc6dd7769bad4c4d96b8dc2e80f0da15/c.html', '新华社记者郎兵兵摄'),
  wuqi: photo('wuqi', '2026年9月26日，陕西吴起县胜利山的中央红军长征胜利纪念园。', 'https://www.news.cn/20261015/7fb3e7b8465a4f87aa7c9c13ec89d77b/c.html', '新华社发，祁小军摄'),
  ganzi: photo('ganzi', '甘孜县孜苏寺前的红二、红四方面军会师地。当代遗址照片，2021年报道所配图。', 'https://sichuan.scol.com.cn/ggxw/202102/58056245.html', '四川在线；刘炳科、兰珍报道，原页未单独标注摄影者'),
  huining: photo('huining', '甘肃会宁中国工农红军第一、二、四方面军会师纪念塔。当代纪念建筑照片，拍摄日期未标注。', 'https://www.huining.gov.cn/mlhn/lsyg/art/2026/art_54dfe41a40af471294fb6744b98ec99d.html', '会宁县融媒体中心／会宁县人民政府网站'),
  jiangtaibao: photo('jiangtaibao', '宁夏西吉县将台堡红军长征会师纪念碑。当代纪念建筑照片，拍摄日期未标注。', 'https://www.xinhuanet.com/politics/2016-08/04/c_129203250.htm', '中央纪委监察部网站／新华网；原页未单独标注摄影者'),
};

export const heroImage: MarchImage = eventMedia.jiajin!;

export const artifactMedia: Record<'belt' | 'lantern' | 'receipt', MarchImage> = {
  belt: { ...photo('belt', '任弼时在长征过草地时吃剩的皮带。中国国家博物馆藏。', 'https://www.chnmuseum.cn/Portals/0/web/zt/20160922longmarch/index.html', '中国国家博物馆', '文物照片'), usage: museumUse },
  lantern: { ...photo('lamp', '林伯渠长征时用过的马灯。中国国家博物馆藏。', 'https://www.chnmuseum.cn/zp/zpml/gmww/202112/t20211207_252709.shtml', '中国国家博物馆', '文物照片'), usage: museumUse },
  receipt: { ...photo('receipt', '红四方面军供给部为白利寺支援青稞、豌豆开具的收据。中国国家博物馆藏。', 'https://www.chnmuseum.cn/zp/zpml/gmww/202112/t20211207_252702.shtml', '中国国家博物馆', '文物照片'), usage: museumUse },
};

export const mapDataSource = {
  url: '/temp/media/central-china-provinces.geojson',
  title: 'Natural Earth 1:50m 现代省级边界（区域展示）',
  sourceUrl: 'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson',
  licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  usage: '公有领域。仅提取与本展示区域有关的12个省区市，不修改原始坐标。边界为现代地理背景，不表示长征时期行政区划。',
};
