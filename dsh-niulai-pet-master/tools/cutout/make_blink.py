"""眨眼帧：双眼区域用上方皮毛纹理填平，画一条 2px 深棕闭眼线。"""
import sys
from PIL import Image, ImageDraw
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
a = np.array(im)

EYES = [(32, 68, 63, 83), (81, 68, 114, 83)]  # 左眼/右眼盒 (x0,y0,x1,y1)
for x0, y0, x1, y1 in EYES:
    for x in range(x0, x1):
        for y in range(y0, y1):
            if a[y, x, 3] > 0:
                a[y, x, :3] = a[y0 - 4 - ((y - y0) % 4), x, :3]  # 向上取皮毛纹理
im = Image.fromarray(a)

d = ImageDraw.Draw(im)
for x0, y0, x1, y1 in EYES:
    cy = (y0 + y1) // 2 + 1
    d.line([(x0 + 2, cy), (x1 - 3, cy)], fill=(66, 40, 22, 255), width=2)
im.save(dst)
print('saved', dst)
