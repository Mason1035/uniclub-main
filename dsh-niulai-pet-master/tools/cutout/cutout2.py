"""抠牛来 v2：放宽犄角暗色阈值，保留与牛身包围盒重叠的连通域（犄角）。"""
from PIL import Image
import numpy as np
from collections import deque

img = Image.open('/tmp/niulai/body_full.png').convert('RGB')
a = np.asarray(img).astype(np.int32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
h, w = R.shape
mx = np.maximum(np.maximum(R, G), B)

# 牛来体色：黄棕/土黄 R>G>B，排除蓝天绿草白云红字
body_tone = (R > 110) & (R > G + 15) & (G > 80) & (G > B + 20) & (B < 140)
# 犄角：深棕/炭色近黑，R 可低至十几；偏暖或中性（B 不明显高于 R），排除纯黑边框与暗绿草
horn_tone = (mx >= 18) & (mx < 150) & (B < R + 40) & (G < R + 30) & ~((G > R + 12) & (G > B + 25))
mask = body_tone | horn_tone
yy, xx = np.mgrid[0:h, 0:w]
mask &= (xx > 720) & (xx < 1140) & (yy > 60) & (yy < 640)

# 全部连通域（4-邻接），单次 BFS
seen = np.zeros_like(mask, dtype=bool)
regions = []  # (size, bbox(y0,y1,x0,x1), pixels)
for sy, sx in zip(*np.nonzero(mask)):
    if seen[sy, sx]:
        continue
    q = deque([(sy, sx)])
    seen[sy, sx] = True
    pix = []
    y0 = y1 = sy
    x0 = x1 = sx
    while q:
        y, x = q.popleft()
        pix.append((y, x))
        if y < y0: y0 = y
        if y > y1: y1 = y
        if x < x0: x0 = x
        if x > x1: x1 = x
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    regions.append((len(pix), (y0, y1, x0, x1), pix))

regions.sort(key=lambda r: -r[0])
print('top regions (size, bbox y0y1x0x1):')
for sz, bb, _ in regions[:8]:
    print(' ', sz, bb)

main_size, main_bb, main_pix = regions[0]
my0, my1, mx0, mx1 = main_bb
keep = np.zeros_like(mask, dtype=bool)
for sz, bb, pix in regions:
    y0, y1, x0, x1 = bb
    # 与主区域包围盒（向上多扩 40px 罩住角尖）相交、且足够大的区域才保留
    overlap = (x1 >= mx0 - 10) and (x0 <= mx1 + 10) and (y1 >= my0 - 40) and (y0 <= my1 + 10)
    if sz >= 120 and overlap:
        for y, x in pix:
            keep[y, x] = True
        print('keep region', sz, bb)

# 填孔（眼睛/鼻孔/白眉等内部空洞）
ys, xs = np.nonzero(keep)
cy0, cy1, cx0, cx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
sub = keep[cy0:cy1, cx0:cx1]
sh, sw = sub.shape
outside = np.zeros_like(sub, dtype=bool)
q = deque()
for x in range(sw):
    for y in (0, sh - 1):
        if not sub[y, x] and not outside[y, x]:
            outside[y, x] = True; q.append((y, x))
for y in range(sh):
    for x in (0, sw - 1):
        if not sub[y, x] and not outside[y, x]:
            outside[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < sh and 0 <= nx < sw and not sub[ny, nx] and not outside[ny, nx]:
            outside[ny, nx] = True; q.append((ny, nx))
filled = sub | ~outside

rgba = np.zeros((sh, sw, 4), dtype=np.uint8)
rgba[..., :3] = np.asarray(img)[cy0:cy1, cx0:cx1]
rgba[..., 3] = (filled * 255).astype(np.uint8)
Image.fromarray(rgba).save('/tmp/niulai/niulai_cutout_v2.png')
print('saved', sw, 'x', sh, 'crop origin', cx0, cy0)
