"""pet_shout 合成 v2：鼻吻下半下拉 2px；口腔深红棕（不纯黑），下半粉红舌头（中线+高光），整体 1px 羽化。"""
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')

# 1) 鼻吻下半（x45-105, y133-153）整体下拉 2px，模拟张嘴下巴
strip = im.crop((45, 133, 105, 153))
im.paste(strip, (45, 135), strip)

# 2) 口腔层：深红棕椭圆 (51,130)-(98,152)
mouth = Image.new('RGBA', im.size, (0, 0, 0, 0))
dm = ImageDraw.Draw(mouth)
dm.ellipse((51, 130, 98, 152), fill=(58, 21, 19, 255))

# 3) 舌头层：粉红椭圆坐进口腔下半，带高光与中线，用口腔硬遮罩裁剪不外溢
tongue = Image.new('RGBA', im.size, (0, 0, 0, 0))
dt = ImageDraw.Draw(tongue)
dt.ellipse((59, 138, 90, 153), fill=(206, 102, 108, 255))          # 舌体
dt.ellipse((65, 139, 78, 143), fill=(232, 148, 148, 255))          # 高光
dt.line([(74, 142), (74, 150)], fill=(163, 68, 76, 255), width=1)  # 中线
m_mask = np.asarray(mouth)[..., 3] > 0
t = np.asarray(tongue).copy()
t[..., 3] = np.where(m_mask, t[..., 3], 0)
tongue = Image.fromarray(t)

layer = Image.alpha_composite(mouth, tongue).filter(ImageFilter.GaussianBlur(1.0))
im = Image.alpha_composite(im, layer)

im.save(dst)
print('saved', dst, im.size)
