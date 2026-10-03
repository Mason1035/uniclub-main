#!/usr/bin/env python3
# 用法: gen.py <base.svg> <out.svg> [--eyes snip] [--spout snip]
# 把 <!--EYES-->..<!--/EYES--> 或 <!--SPOUT--> 标记替换为代码片段
import re, sys

base_path, out_path = sys.argv[1], sys.argv[2]
text = open(base_path).read()
args = sys.argv[3:]
i = 0
while i < len(args):
    flag, snip_path = args[i], args[i + 1]
    snip = open(snip_path).read().strip('\n')
    if flag == '--eyes':
        text = re.sub(r'<!--EYES-->.*?<!--/EYES-->', lambda m: snip, text, flags=re.S)
    elif flag == '--spout':
        text = text.replace('<!--SPOUT-->', snip)
    i += 2
open(out_path, 'w').write(text)
print('gen', out_path)
