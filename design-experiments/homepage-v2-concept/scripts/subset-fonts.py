"""Rebuild compact page fonts from Typography Lab's existing official source cache.
Usage: python scripts/subset-fonts.py /absolute/path/to/font-sources
Runtime uses the prebuilt WOFF2 files; this script is not needed to launch.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
sources = Path(sys.argv[1]).resolve()
output = root / 'public/fonts'
output.mkdir(parents=True, exist_ok=True)
copy = '\n'.join(p.read_text() for p in [*sorted((root / 'src').glob('*.tsx')), *sorted((root / 'src').glob('*.ts')), root / 'index.html'])
chinese = {ord(c) for c in copy if ord(c) > 127} | {0x3000, 0x3001, 0x3002, 0xff0c, 0xff1a}
signature = {ord(c) for c in '留个页角，明天再来。明天见。'}
latin = set(range(0x20, 0x100)) | set(range(0x2000, 0x2070))
families = [
    ('serif', 'Concept Han Serif', '250 900', chinese),
    ('sans', 'Concept Han Sans', '250 900', chinese),
    ('smiley', 'Concept Smiley', '400', signature),
    ('latin', 'Concept Grotesk', '400 900', latin),
]
records = []
rules = []
for key, family, weight, requested in families:
    source = sources / (key + ('.ttf' if key == 'latin' else '.woff2'))
    font = TTFont(source)
    supported = set(font.getBestCmap())
    chars = requested & supported
    missing_chinese = [chr(c) for c in sorted(requested - supported) if 0x4e00 <= c <= 0x9fff]
    if missing_chinese:
        raise SystemExit(f'{family}: missing Chinese glyphs {missing_chinese}')
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.recalc_timestamp = False
    opts.flavor = 'woff2'
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=chars)
    sub.subset(font)
    for name in font['name'].names:
        if name.nameID in (1, 3, 4, 6, 16, 17):
            value = family.replace(' ', '') if name.nameID == 6 else 'Regular' if name.nameID == 17 else family
            name.string = value.encode(name.getEncoding(), errors='replace')
        elif name.nameID >= 256:
            value = re.sub(r'SourceHan(Serif|Sans)CNVF', lambda m: 'ConceptHan' + m[1] + 'VF', name.toUnicode())
            name.string = value.encode(name.getEncoding(), errors='replace')
    font.flavor = 'woff2'
    path = output / f'{key}.woff2'
    font.save(path)
    axes = [{'tag': a.axisTag, 'min': a.minValue, 'max': a.maxValue} for a in font['fvar'].axes] if 'fvar' in font else []
    records.append({'file': path.name, 'family': family, 'bytes': path.stat().st_size, 'glyphs': len(chars), 'axes': axes, 'missingChinese': missing_chinese})
    rules.append(f"@font-face {{ font-family: '{family}'; font-style: normal; font-weight: {weight}; font-display: swap; src: url('/fonts/{key}.woff2') format('woff2'); }}")
    print(key, path.stat().st_size, 'bytes', len(chars), 'glyphs', flush=True)
(output / 'fonts.css').write_text('\n'.join(rules) + '\n')
(output / 'manifest.json').write_text(json.dumps({'note': 'Page subsets of the same cached fonts selected by Typography Lab. No downloaded fonts or production font changes.', 'totalBytes': sum(r['bytes'] for r in records), 'files': records}, ensure_ascii=False, indent=2) + '\n')
print('TOTAL', sum(r['bytes'] for r in records), flush=True)
