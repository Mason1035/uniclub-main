"""牛来原皮 11：派生帧（张嘴/眨眼）+ 出 final 三件套。
坐标基于 10_raw.png (793x1326)。缩放比 vs 旧 pet.png 约 5x。
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

SRC = '/tmp/niulai-orig/10_raw.png'
OUT = '/tmp/niulai-orig/final'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGBA')

# ---------- shout：张嘴 ----------
sh = im.copy()
# 1) 鼻吻下半下拉 12px
strip = sh.crop((270, 380, 505, 442))
sh.paste(strip, (270, 392), strip)
# 2) 口腔：深红棕椭圆
mouth = Image.new('RGBA', sh.size, (0, 0, 0, 0))
dm = ImageDraw.Draw(mouth)
dm.ellipse((290, 370, 492, 440), fill=(58, 21, 19, 255))
# 3) 舌头：粉红 + 高光 + 中线，用口腔遮罩裁剪
tongue = Image.new('RGBA', sh.size, (0, 0, 0, 0))
dt = ImageDraw.Draw(tongue)
dt.ellipse((330, 396, 452, 442), fill=(206, 102, 108, 255))
dt.ellipse((352, 400, 396, 412), fill=(232, 148, 148, 255))
dt.line([(390, 405), (390, 432)], fill=(163, 68, 76, 255), width=4)
m_mask = np.asarray(mouth)[..., 3] > 0
t = np.asarray(tongue).copy()
t[..., 3] = np.where(m_mask, t[..., 3], 0)
tongue = Image.fromarray(t)
layer = Image.alpha_composite(mouth, tongue).filter(ImageFilter.GaussianBlur(2.5))
sh = Image.alpha_composite(sh, layer)

# ---------- blink：闭眼 ----------
bl = im.copy()
ba = np.array(bl)
EYES = [(248, 160, 325, 212), (465, 160, 545, 212)]
for x0, y0, x1, y1 in EYES:
    for x in range(x0, x1):
        for y in range(y0, y1):
            if ba[y, x, 3] > 0:
                ba[y, x, :3] = ba[y0 - 8 - ((y - y0) % 6), x, :3]  # 取上方皮毛
bl = Image.fromarray(ba)
dbl = ImageDraw.Draw(bl)
for x0, y0, x1, y1 in EYES:
    cy = (y0 + y1) // 2 + 4
    dbl.line([(x0 + 8, cy), (x1 - 10, cy)], fill=(90, 50, 25, 255), width=7)

# ---------- 出件：高 500 ----------
def shrink(img):
    w, h = img.size
    nw = round(w * 500 / h)
    return img.resize((nw, 500), Image.LANCZOS)

shrink(im).save(f'{OUT}/pet_orig.png')
shrink(sh).save(f'{OUT}/pet_orig_shout.png')
shrink(bl).save(f'{OUT}/pet_orig_blink.png')
for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')
