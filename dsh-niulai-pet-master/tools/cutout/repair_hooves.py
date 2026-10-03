"""蹄子修补 v4：平底重建 + 程序化蹄冠。
蹄形：上窄下宽微梯形（顶窄 4px）、顶边向上拱 1.5px、底部齐 y=330、左右各外移 1.5px 并外倾剪切 1.2px（微外八）；
体积：(56,45,37)→(44,35,29) 纵向渐变；分趾缝 2px 宽 8px 深 #2b221c 到底边；
4x 超采样 + 高斯圆角 + LANCZOS 降采样 = 圆角与 1px 羽化。"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = '/tmp/niulai/niulai_cutout_v2.png'
Y_CUT = 308
Y_FLOOR = 330
HOOF_TOP = 306
C_TOP = np.array([56, 45, 37], dtype=np.float32)
C_BOT = np.array([44, 35, 29], dtype=np.float32)
CLEFT = (43, 34, 28)

im = Image.open(SRC).convert('RGBA')
a = np.asarray(im).astype(np.int32)
A = a[..., 3]
h, w = A.shape

# ---- 平底重建（同 v3）----
row = A[Y_CUT] > 0
cols = np.nonzero(row)[0]
legs = []
cur = [cols[0]]
for x in cols[1:]:
    if x - cur[-1] <= 3:
        cur.append(x)
    else:
        legs.append((cur[0], cur[-1]))
        cur = [x]
legs.append((cur[0], cur[-1]))
print('legs at cut row:', legs)

out = a.copy()
for x0, x1 in legs:
    for x in range(x0, x1 + 1):
        for y in range(Y_CUT + 1, Y_FLOOR + 1):
            src_y = Y_CUT - 1 - ((y - Y_CUT - 1) % 7)
            fade = 1.0 - 0.07 * (y - Y_CUT) / (Y_FLOOR - Y_CUT)
            out[y, x, :3] = np.clip(out[src_y, x, :3] * fade, 0, 255)
            out[y, x, 3] = 255
keep_x = np.zeros(w, dtype=bool)
for x0, x1 in legs:
    keep_x[x0:x1 + 1] = True
for y in range(Y_CUT + 1, h):
    out[y, ~keep_x, 3] = 0
out[Y_FLOOR + 1:, :, 3] = 0
base = Image.fromarray(out.astype(np.uint8))

# ---- 程序化蹄冠（4x 超采样）----
S = 4
H, W = h * S, w * S
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) / S  # 1x 坐标系

# (底中心x, 顶中心x) —— 左蹄外移 1.5 + 外倾 1.2；右蹄镜像
HOOVES = [(47.0, 45.8), (105.5, 106.7)]
WB, WT = 20.0, 18.0
mask = np.zeros((H, W), dtype=np.uint8)
for cxb, cxt in HOOVES:
    t = (yy - HOOF_TOP) / (Y_FLOOR - HOOF_TOP)          # 0=顶 1=底
    hw = WT + (WB - WT) * t                              # 梯形半宽
    cx = cxt + (cxb - cxt) * t                           # 外倾剪切中心线
    arch = HOOF_TOP - 1.5 * np.clip(1 - ((xx - cxt) / WT) ** 2, 0, 1)  # 顶边上拱
    inside = (yy >= arch) & (yy <= Y_FLOOR) & (np.abs(xx - cx) <= hw)
    mask |= (inside * 255).astype(np.uint8)

# 高斯圆角（阈值化后角半径≈4-5px@1x）
mask_im = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(3 * S))
mask = (np.asarray(mask_im) > 128).astype(np.uint8) * 255

# 纵向渐变填色
t4 = np.clip((yy - HOOF_TOP) / (Y_FLOOR - HOOF_TOP), 0, 1)
col = C_TOP[None, None, :] * (1 - t4[..., None]) + C_BOT[None, None, :] * t4[..., None]

hoof4 = np.zeros((H, W, 4), dtype=np.uint8)
hoof4[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
hoof4[..., 3] = mask
hoof1 = Image.fromarray(hoof4).resize((w, h), Image.LANCZOS)  # 降采样=1px 羽化

res = Image.alpha_composite(base, hoof1)
ra = np.asarray(res).copy()

# 分趾缝（降采样后 1x 直绘，保住对比度）：2px 宽、9px 深、到底边，缝顶圆头，随蹄中心线微斜
yy1, xx1 = np.mgrid[0:h, 0:w].astype(np.float32)
for cxb, cxt in HOOVES:
    tt = (yy1 - HOOF_TOP) / (Y_FLOOR - HOOF_TOP)
    cxr = cxt + (cxb - cxt) * tt
    cl = (yy1 >= Y_FLOOR - 9) & (yy1 <= Y_FLOOR) & (np.abs(xx1 - cxr) < 1.0) & (ra[..., 3] > 0)
    cap = ((xx1 - cxb) ** 2 + (yy1 - (Y_FLOOR - 9)) ** 2 <= 1.2 ** 2) & (ra[..., 3] > 0)
    ra[..., :3][cl | cap] = np.array(CLEFT, dtype=np.float32)

ra[Y_FLOOR + 1:, :, 3] = 0  # 保险：底线以下全透明
res = Image.fromarray(ra)
res.save('/tmp/niulai/pet_hoof.png')
print('saved /tmp/niulai/pet_hoof.png')
