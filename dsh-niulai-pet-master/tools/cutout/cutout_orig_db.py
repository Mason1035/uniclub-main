"""牛来原皮（三视图正面）：白底抠图。
背景近白且中性（R≈G≈B 高亮）；嘴套/蹄奶油色 B 比 G 低 15+，可分开。
"""
from PIL import Image, ImageFilter
import numpy as np
from collections import deque

im = Image.open('/home/tenbox/Desktop/Workspace/niulai_db.png').convert('RGB')
# 正面图区域（整图 2848x1600 的中段）
crop = im.crop((940, 0, 1908, 1600))
a = np.asarray(crop).astype(np.int32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
h, w = R.shape

bg = (R > 218) & (G > 218) & (B > 218) & (np.abs(R - B) < 20)
# 地面软阴影：亮灰中性色，只出现在腿部以下（不除会在蹄底搭桥封住腿缝）；
# 千万不能全图用——嘴套褶皱的中性灰也是这个色（嘴套黑斑事故）
yy0, xx0 = np.mgrid[0:h, 0:w]
shadow = (yy0 > 1100) & (R > 198) & (G > 198) & (B > 198) & (np.abs(R - G) < 14) & (np.abs(G - B) < 14)
mask = ~(bg | shadow)
# 排除右缘背视图残条
yy, xx = np.mgrid[0:h, 0:w]
mask &= xx < 905

# 最大连通域 = 本体
seen = np.zeros_like(mask, dtype=bool)
best = []
for sy, sx in zip(*np.nonzero(mask)):
    if seen[sy, sx]:
        continue
    q = deque([(sy, sx)])
    seen[sy, sx] = True
    pix = []
    while q:
        y, x = q.popleft()
        pix.append((y, x))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    if len(pix) > len(best):
        best = pix

keep = np.zeros_like(mask)
for y, x in best:
    keep[y, x] = True

# 内孔填充（眼睛等暗部被 bg 规则误杀）
bgm = ~keep
seen = np.zeros_like(bgm, dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if bgm[y, x] and not seen[y, x]:
            seen[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if bgm[y, x] and not seen[y, x]:
            seen[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and bgm[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((ny, nx))
keep |= bgm & ~seen

# 腿缝清除：从缝内已知点泛洪，只走浅色/近白像素（橙色腿身不越界）。
# 全填孔保证嘴套高光等浅色内部特征完好（之前"近白孔不填"会在这烧出黑斑）。
pale = (R > 210) & (G > 210) & (B > 200)
seen2 = np.zeros_like(pale, dtype=bool)
q = deque([(1305, 400)])  # crop 坐标：腿缝内一点
seen2[1305, 400] = True
cleared = 0
while q:
    y, x = q.popleft()
    if keep[y, x]:
        keep[y, x] = False
        cleared += 1
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and pale[ny, nx] and not seen2[ny, nx]:
            seen2[ny, nx] = True
            q.append((ny, nx))
print('leg-gap cleared px:', cleared)

ys, xs = np.nonzero(keep)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
print('bbox:', x0, y0, x1, y1, 'size', x1 - x0 + 1, 'x', y1 - y0 + 1)
alpha = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
rgba = crop.crop((x0, y0, x1 + 1, y1 + 1)).convert('RGBA')
rgba.putalpha(alpha.crop((x0, y0, x1 + 1, y1 + 1)))
rgba.save('/tmp/niulai-orig/10_raw.png')
print('saved /tmp/niulai-orig/10_raw.png', rgba.size)
