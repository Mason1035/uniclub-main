#!/usr/bin/env python3
# 用法: post.py <in.png> <out.png> [pad_1x=8]
# 裁剪透明边 → 加 pad(1x 单位) → 预乘 alpha 降采样一半(渲染是 2x)
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
pad = int(sys.argv[3]) if len(sys.argv) > 3 else 8

im = Image.open(src).convert('RGBA')
bbox = im.getchannel('A').getbbox()
if bbox is None:
    raise SystemExit('empty alpha bbox!')
im = im.crop(bbox)
w, h = im.size
p2 = pad * 2  # 渲染图是 2x
canvas = Image.new('RGBA', (w + 2 * p2, h + 2 * p2), (0, 0, 0, 0))
canvas.paste(im, (p2, p2))

# 预乘 alpha 再 LANCZOS 缩到 1x, 避免透明黑边晕色
a = np.asarray(canvas).astype(np.float32)
alpha = a[..., 3:4] / 255.0
a[..., :3] *= alpha
prem = Image.fromarray(a.astype(np.uint8), 'RGBA')
out_w, out_h = round(canvas.width / 2), round(canvas.height / 2)
prem = prem.resize((out_w, out_h), Image.LANCZOS)
b = np.asarray(prem).astype(np.float32)
al = b[..., 3:4] / 255.0
nz = al > 0
b[..., :3] = np.where(nz, np.clip(b[..., :3] / np.maximum(al, 1e-6), 0, 255), 0)
Image.fromarray(b.astype(np.uint8), 'RGBA').save(dst)
print(dst, f'{out_w}x{out_h}')
