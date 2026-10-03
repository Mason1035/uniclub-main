"""pet_young 合成：去犄角（按列切到首个亮像素）+ 头顶补圆滑 + 残留修复 + 黄亮调色。"""
from PIL import Image, ImageFilter
import numpy as np

SRC = '/home/tenbox/Desktop/Devspace/dsh-niulai-pet/assets/pet.png'
DST = '/tmp/niulai/pet_young.png'

im = Image.open(SRC).convert('RGBA')
a = np.asarray(im).astype(np.int32)
R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
h, w = A.shape
mx = np.maximum(np.maximum(R, G), B)

# 犄角色（放宽）：暗、偏暖/中性、非绿
hornish = (mx < 165) & (B < R + 45) & (G < R + 35) & ~((G > R + 12) & (G > B + 25))

top = np.full(w, -1)
top_head = np.full(w, -1)
for x in range(w):
    ys = np.nonzero(A[:, x] > 0)[0]
    if len(ys):
        top[x] = ys.min()
    ys2 = np.nonzero((A[:, x] > 0) & (~hornish[:, x]))[0]
    if len(ys2):
        top_head[x] = ys2.min()

# 犄角列：顶部暗色堆叠明显（首个亮像素比首个不透明像素低 8px 以上，且顶端在 y75 以上）；
# top_head=-1 表示整列无亮像素（纯角尖列），整列裁掉
new_top = top.copy()
for x in range(w):
    if top[x] >= 0 and top[x] < 75:
        if top_head[x] < 0:
            new_top[x] = h
        elif top_head[x] > top[x] + 8:
            new_top[x] = top_head[x]

# 中值滤波（k=3）去单像素台阶，只在变低的列裁剪（纯去角不补肉）
med = new_top.copy()
for x in range(w):
    lo, hi = max(0, x - 1), min(w, x + 2)
    med[x] = int(np.median(new_top[lo:hi]))
clip_to = np.maximum(top, med)  # top=-1 的列不动
clip_to = np.minimum(clip_to, 85)  # 裁剪严格限制在去角区（y<85），绝不动身体

# 头顶抛物线兜底：x28-120 内（两耳之间）任何高出圆滑颅顶 1px 以上的残桩一律削平
cx, ymin, aa = 77.0, 17.0, 0.0074
for x in range(28, 121):
    dome = int(round(ymin + aa * (x - cx) ** 2)) - 1
    if top[x] >= 0 and clip_to[x] < dome:
        clip_to[x] = dome
A2 = A.copy()
for x in range(w):
    if top[x] >= 0 and clip_to[x] > top[x]:
        A2[:clip_to[x], x] = 0

# 残留修复：角基区（x28-52 / x102-127）且贴近颅顶轮廓（y < 抛物线+12）的犄角色像素，
# 用周围亮头色模糊填补。眉毛/眼睛远在限高以下，不受影响
yy, xx = np.mgrid[0:h, 0:w]
dome_arr = (17.0 + 0.0074 * (xx - 77.0) ** 2).astype(np.int32) + 12
horn_zone = ((xx >= 28) & (xx <= 52)) | ((xx >= 102) & (xx <= 127))
zone = horn_zone & (yy < dome_arr)
need_fix = (A2 > 0) & hornish & zone
valid = ((A2 > 0) & ~(hornish & zone)).astype(np.float32)
rgb = a[..., :3].astype(np.float32)
num = np.zeros_like(rgb)
for c in range(3):
    num[..., c] = np.asarray(
        Image.fromarray((rgb[..., c] * valid).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    ).astype(np.float32)
den = np.asarray(Image.fromarray((valid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))).astype(np.float32) / 255.0
healed = num / np.maximum(den[..., None], 1e-3)
fix = need_fix & (den > 0.05)
rgb[fix] = healed[fix]
print('clipped cols:', int((clip_to > top).sum()), 'healed px:', int(fix.sum()))

# 黄亮调色：HSV，色相往黄 +8°，饱和 x1.18，明度 x1.10
rgbf = np.clip(rgb, 0, 255) / 255.0
r, g, b = rgbf[..., 0], rgbf[..., 1], rgbf[..., 2]
cmax = rgbf.max(-1); cmin = rgbf.min(-1)
delta = cmax - cmin
V = cmax
S = np.where(cmax > 1e-6, delta / np.maximum(cmax, 1e-6), 0)
H = np.zeros_like(cmax)
m = delta > 1e-6
i = m & (cmax == r); H[i] = ((g - b)[i] / delta[i]) % 6
i = m & (cmax == g); H[i] = (b - r)[i] / delta[i] + 2
i = m & (cmax == b); H[i] = (r - g)[i] / delta[i] + 4
H = H / 6.0
op = A2 > 0
H2 = H + 0.022
S2 = np.clip(S * 1.18, 0, 1)
V2 = np.clip(V * 1.10, 0, 1)
Hh = (H2 % 1.0) * 6
Cc = S2 * V2
X = Cc * (1 - np.abs(Hh % 2 - 1))
z = np.zeros_like(Hh)
rgb2 = np.zeros_like(rgbf)
for lo, hi, sl in ((0, 1, (Cc, X, z)), (1, 2, (X, Cc, z)), (2, 3, (z, Cc, X)),
                   (3, 4, (z, X, Cc)), (4, 5, (X, z, Cc)), (5, 6, (Cc, z, X))):
    mm = (Hh >= lo) & (Hh < hi)
    for c in range(3):
        rgb2[..., c][mm] = sl[c][mm]
rgb2 += (V2 - Cc)[..., None]
out = np.zeros((*A2.shape, 4), dtype=np.uint8)
out[..., :3] = np.clip(rgb2 * 255, 0, 255).astype(np.uint8)
out[..., 3] = A2.astype(np.uint8)
Image.fromarray(out).save(DST)
print('saved', DST, out.shape)
