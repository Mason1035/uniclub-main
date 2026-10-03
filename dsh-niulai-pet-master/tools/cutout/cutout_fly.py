"""pet_fly 抠图：BV1xzbi6WEkP.mp4 t=17.6 帧，橙色牛装人俯冲姿态，去绿幕背景，旋转成俯冲角。"""
from PIL import Image
import numpy as np
from collections import deque

img = Image.open('/tmp/niulai/ff_17.6.png').convert('RGB')
a = np.asarray(img).astype(np.int32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
h, w = R.shape

# 橙色牛装（亮橙，R 远高于 G/B）
orange = (R > 150) & (R > G + 40) & (G > 70) & (G > B + 20) & (B < 130)
# 暖白（手套/鞋/帽吻）：排除冷白的池塘水面（B>R 的不要）
warmwhite = (R > 185) & (G > 175) & (B > 145) & (R >= B - 10)
mask = orange | warmwhite
# 限定人物大致区域，排除边框杂物
yy, xx = np.mgrid[0:h, 0:w]
mask &= (xx > 480) & (xx < 900) & (yy > 150) & (yy < 470)

seen = np.zeros_like(mask, dtype=bool)
regions = []
for sy, sx in zip(*np.nonzero(mask)):
    if seen[sy, sx]:
        continue
    q = deque([(sy, sx)])
    seen[sy, sx] = True
    pix = []
    y0 = y1 = sy; x0 = x1 = sx
    while q:
        y, x = q.popleft()
        pix.append((y, x))
        y0 = min(y0, y); y1 = max(y1, y); x0 = min(x0, x); x1 = max(x1, x)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    regions.append((len(pix), (y0, y1, x0, x1), pix))

regions.sort(key=lambda r: -r[0])
for sz, bb, _ in regions[:6]:
    print('region', sz, bb)
main_size, mb, _ = regions[0]
my0, my1, mx0, mx1 = mb
keep = np.zeros_like(mask, dtype=bool)
for sz, bb, pix in regions:
    y0, y1, x0, x1 = bb
    overlap = (x1 >= mx0 - 25) and (x0 <= mx1 + 25) and (y1 >= my0 - 25) and (y0 <= my1 + 25)
    if sz >= 40 and overlap:
        for y, x in pix:
            keep[y, x] = True
        print('keep', sz, bb)

# 填孔
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
out = Image.fromarray(rgba)
out.save('/tmp/niulai/fly_cut_raw.png')

# 旋转成俯冲角：头在左，逆时针 +14° 让头略低于脚
rot = out.rotate(14, resample=Image.BICUBIC, expand=True)
ra = np.asarray(rot)
alpha = ra[..., 3]
# 旋转插值产生的半透明边缘保留；裁到内容包围盒
ys, xs = np.nonzero(alpha > 8)
ry0, ry1, rx0, rx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
final = rot.crop((rx0, ry0, rx1, ry1))
final.save('/tmp/niulai/pet_fly.png')
print('raw', sw, 'x', sh, 'final', final.size)
