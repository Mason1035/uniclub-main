"""Build ClassHub's self-hosted fonts from the pinned official Typography Lab sources.

Usage: python scripts/build-fonts.py /path/to/official-font-sources [--only=smiley,latin | --metadata-only]
Requires fonttools[woff] 4.66.1 and Brotli 1.2.0; no build-time network access.
Derived font names are changed; original copyright/OFL metadata is retained.
"""
from collections import Counter
from pathlib import Path
import hashlib
import io
import json
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/fonts/classhub'
COMMON_SHARD_SIZE = 96
TAIL_SHARD_SIZE = 384
PUBLIC_CORE_PATHS = (
    'src/components/Layout.tsx',
    'src/components/SiteHeader.tsx',
    'src/components/SiteFooter.tsx',
    'src/components/BottomNavigation.tsx',
    'src/components/ContentState.tsx',
    'src/components/privacy/CookieConsent.tsx',
    'src/components/privacy/cookie-consent.css',
    'src/pages/Homepage.tsx',
    'src/components/home/IOSInstallCard.tsx',
)
SOURCES = {
    'serif': ('serif.woff2', 'ClassHub Han Serif', '250 900', '556749ba783b148fa1f48644e8883e5b9351f01abd0d1faad0ba24a21185e76a'),
    'sans': ('sans.woff2', 'ClassHub Han Sans', '250 900', 'f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799'),
    'smiley': ('smiley.woff2', 'ClassHub Pulse', '400', '731f22973349404b15a88a99ef3b5dd4104c0965c23b7e485c1f11e84fea99e2'),
    'latin': ('latin.ttf', 'ClassHub Grotesk', '400 900', '6ceeadf6be8e1fd7687011c7fa38ed0edd1abe967a0b73d97caec183552e823d'),
}


def unicode_ranges(chars):
    spans = []
    for c in sorted(chars):
        if spans and c == spans[-1][1] + 1:
            spans[-1][1] = c
        else:
            spans.append([c, c])
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in spans)


def main():
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    sources = Path(sys.argv[1]).resolve()
    requested = set(SOURCES)
    if len(sys.argv) == 3:
        if sys.argv[2] == '--metadata-only':
            requested = set()
        elif sys.argv[2].startswith('--only='):
            requested = set(sys.argv[2].removeprefix('--only=').split(','))
            if not requested or not requested <= set(SOURCES):
                raise SystemExit('Unknown font family in --only')
        else:
            raise SystemExit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    OUT.chmod(0o755)
    data = {key: (sources / spec[0]).read_bytes() for key, spec in SOURCES.items()}
    for key, spec in SOURCES.items():
        if spec[3] and hashlib.sha256(data[key]).hexdigest() != spec[3]:
            raise SystemExit(f'{key}: official source hash does not match FONT_NOTES.md')
    # Verify the original Smiley release archive as well as the extracted source.
    import zipfile
    archive = sources / 'smiley.zip'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != '299c0be6c960ae37361762eca76f7d0cd516615435bb96c0d4b98a1e70178a07':
        raise SystemExit('Smiley official release archive hash does not match')
    with zipfile.ZipFile(archive) as z:
        names = [n for n in z.namelist() if n.endswith('.ttf.woff2') and '__MACOSX' not in n]
        if data['smiley'] != z.read(names[0]):
            raise SystemExit('Smiley extracted source does not match the official archive')

    corpus_paths = sorted(p for p in (ROOT / 'src').rglob('*') if p.suffix in ('.tsx', '.ts'))
    corpus = '\n'.join(p.read_text() for p in corpus_paths)
    chinese = Counter(ord(c) for c in corpus if '\u3400' <= c <= '\u9fff')
    punctuation = set(range(0x3000, 0x3040)) | set(range(0xff01, 0xff60)) | {0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026}
    # Keep universal preloads small: these files own the shared chrome and the
    # initial Home copy. Other routes and dynamic text still have full coverage.
    public_copy = '\n'.join((ROOT / p).read_text() for p in PUBLIC_CORE_PATHS)
    home_copy = (ROOT / 'src/pages/Homepage.tsx').read_text()
    editorial_copy = '\n'.join(re.findall(r'title="([^"]+)"', home_copy))
    editorial_copy += '\n'.join(re.findall(r'<p className="hero-copy">(.*?)</p>', home_copy, re.S))
    ios_copy = (ROOT / 'src/components/home/IOSInstallCard.tsx').read_text()
    editorial_copy += '\n'.join(re.findall(r'<h2 id="ios-install-card-title">(.*?)</h2>', ios_copy, re.S))
    editorial_copy += '\n'.join(re.findall(r'<SheetTitle[^>]*>(.*?)</SheetTitle>', ios_copy, re.S))
    def han_characters(text):
        return {ord(c) for c in text if '\u3400' <= c <= '\u9fff' or ord(c) in punctuation}
    editorial_core = han_characters(editorial_copy)
    ui_core = han_characters(public_copy)
    # The source corpus ranks the small common shards by actual app frequency.
    # Do not separate all GB2312 characters from the tail: doing so punched
    # thousands of holes in both groups and bloated exact unicode-range CSS.
    common_by_frequency = [c for c, _ in chinese.most_common()]
    latin_supported = set(TTFont(io.BytesIO(data['latin'])).getBestCmap())
    # CJK/fullwidth punctuation, curly quotation marks and ellipsis stay in the Han faces.
    latin_chars = {c for c in latin_supported if c >= 0x20 and c not in punctuation and not 0xe000 <= c <= 0xf8ff and not 0x2160 <= c <= 0x217f and not 0x2460 <= c <= 0x24ff}
    latin_core = {c for c in latin_chars if c <= 0x7e} | {ord(c) for c in public_copy if ord(c) in latin_chars}
    cores = {'sans': ui_core, 'serif': editorial_core, 'smiley': {ord(c) for c in '班级动态'}, 'latin': latin_core}
    records, source_info = [], {}
    if requested != set(SOURCES):
        previous = json.loads((OUT / 'manifest.json').read_text())
        for record in previous['files']:
            key = record['file'].split('-')[0].split('.')[0]
            if key == 'signature':
                key = 'smiley'
            if key not in requested:
                payload = (OUT / record['file']).read_bytes()
                if len(payload) != record['bytes'] or hashlib.sha256(payload).hexdigest() != record['sha256']:
                    raise SystemExit(f"{record['file']}: existing font does not match manifest")
                records.append(record)
        source_info = {k: v for k, v in previous['sources'].items() if k not in requested}

    def make(raw, chars, name, family, weight):
        font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['*']
        # fonttools' default name subset omits the source license entries.
        # Preserve original copyright, author and OFL metadata in every shard.
        options.name_IDs = ['*']
        options.name_languages = ['*']
        options.recalc_timestamp = False
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=chars)
        worker.subset(font)
        # Layout closure can retain another character mapped to the same glyph.
        # Keep layout glyphs, but expose only this shard's assigned code points.
        for table in font['cmap'].tables:
            if table.isUnicode() and hasattr(table, 'cmap'):
                table.cmap = {c: g for c, g in table.cmap.items() if c in chars}
        for entry in font['name'].names:
            if entry.nameID in (1, 3, 4, 6, 16, 18, 20, 21, 25):
                value = family.replace(' ', '') if entry.nameID in (6, 20, 25) else family
            elif entry.nameID >= 256:
                value = re.sub(r'SourceHan(Serif|Sans)CNVF', lambda m: 'ClassHubHan' + m[1] + 'VF', entry.toUnicode())
            else:
                continue
            entry.string = value.encode(entry.getEncoding(), errors='replace')
        actual = set(font.getBestCmap())
        if actual != chars:
            raise RuntimeError(f'{name}: missing {sorted(chars - actual)}, extra {sorted(actual - chars)}')
        expected_axes = [('wght', float(v[0]), float(v[1]))] if len(v := weight.split()) == 2 else []
        actual_axes = [(a.axisTag, a.minValue, a.maxValue) for a in font['fvar'].axes] if 'fvar' in font else []
        if actual_axes != expected_axes or expected_axes and not {'gvar', 'HVAR'} <= set(font.keys()):
            raise RuntimeError(f'{name}: variable font axes/tables changed')
        if not {0, 13, 14} <= {entry.nameID for entry in font['name'].names}:
            raise RuntimeError(f'{name}: copyright/OFL metadata missing')
        font.flavor = 'woff2'
        payload_buffer = io.BytesIO()
        font.save(payload_buffer)
        payload = payload_buffer.getvalue()
        digest = hashlib.sha256(payload).hexdigest()
        fingerprinted_name = name.removesuffix('.woff2') + '.' + digest[:10] + '.woff2'
        (OUT / fingerprinted_name).write_bytes(payload)
        (OUT / fingerprinted_name).chmod(0o644)
        records.append({'file': fingerprinted_name, 'family': family, 'bytes': len(payload), 'sha256': digest, 'characters': len(actual), 'unicodeRange': unicode_ranges(actual)})

    for key, (_, family, weight, _) in SOURCES.items():
        if key not in requested:
            continue
        font = TTFont(io.BytesIO(data[key]), recalcTimestamp=False)
        supported = set(font.getBestCmap())
        selected = latin_chars if key == 'latin' else {c for c in supported - latin_chars if c >= 0xa0 and not 0xe000 <= c <= 0xf8ff}
        initial = cores[key] & selected
        source_info[key] = {
            'originalSha256': hashlib.sha256(data[key]).hexdigest(),
            'originalBytes': len(data[key]),
            'axes': [{'tag': a.axisTag, 'min': a.minValue, 'max': a.maxValue} for a in font['fvar'].axes] if 'fvar' in font else [],
            'coveredCharacters': len(selected), 'coreCharacters': len(initial),
            'missingStaticChinese': ''.join(chr(c) for c in sorted(set(chinese) - supported)) if key != 'latin' else '',
        }
        font.flavor = None
        buffer = io.BytesIO()
        font.save(buffer)
        raw = buffer.getvalue()
        prefix = 'signature' if key == 'smiley' else key
        make(raw, initial, prefix + '-core.woff2', family, weight)
        remaining = selected - initial
        frequent = [c for c in common_by_frequency if c in remaining] if key in ('serif', 'sans') else []
        groups = [('common', frequent, COMMON_SHARD_SIZE),
                  ('tail', sorted(remaining - set(frequent)), TAIL_SHARD_SIZE)]
        for group, characters, size in groups:
            for i in range(0, len(characters), size):
                make(raw, set(characters[i:i + size]), f'{prefix}-{group}-{i // size:02d}.woff2', family, weight)
                if i % (size * 20) == 0:
                    print(key, group, 'shard', i // size, flush=True)
        print(key, source_info[key], flush=True)
    # Partial rebuilds must produce the same stylesheet order as a full build.
    family_order = {spec[1]: i for i, spec in enumerate(SOURCES.values())}
    records.sort(key=lambda r: (family_order[r['family']], '-core.' not in r['file'], r['file']))
    expected = {r['file'] for r in records}
    for old in OUT.glob('*.woff2'):
        if old.name not in expected:
            old.unlink()
    weights = {spec[1]: spec[2] for spec in SOURCES.values()}
    header = '/* Generated by scripts/build-fonts.py; see FONT_NOTES.md for OFL provenance. */\n'
    def face(record):
        return f'@font-face{{font-family:"{record["family"]}";font-style:normal;font-weight:{weights[record["family"]]};font-display:swap;src:url(/fonts/classhub/{record["file"]}) format("woff2");unicode-range:{record["unicodeRange"]}}}'
    core_css = header + '\n'.join(face(r) for r in records if '-core.' in r['file']) + '\n'
    extended_css = header + '\n'.join(face(r) for r in records if '-core.' not in r['file']) + '\n'
    extended_digest = hashlib.sha256(extended_css.encode()).hexdigest()
    extended_name = f'fonts-extended.{extended_digest[:10]}.css'
    # A same-origin external loader works with script-src 'self', requires no
    # inline handler, and handles a cached stylesheet that loaded before defer.
    loader = "(() => { const link = document.querySelector('link[data-classhub-fonts=\"extended\"]'); if (!link) return; const apply = () => { link.media = 'all'; }; link.addEventListener('load', apply, { once: true }); if (link.sheet) apply(); })();\n"
    loader_digest = hashlib.sha256(loader.encode()).hexdigest()
    loader_name = f'fonts-loader.{loader_digest[:10]}.js'
    (OUT / 'fonts-core.css').write_text(core_css)
    (OUT / extended_name).write_text(extended_css)
    (OUT / loader_name).write_text(loader)
    stylesheets = {'core': 'fonts-core.css', 'extended': extended_name, 'extendedSha256': extended_digest, 'loader': loader_name, 'loaderSha256': loader_digest}
    (OUT / 'manifest.json').write_text(json.dumps({'commonShardSize': COMMON_SHARD_SIZE, 'tailShardSize': TAIL_SHARD_SIZE, 'corePaths': list(PUBLIC_CORE_PATHS), 'commonOrder': 'static-source-frequency', 'tailOrder': 'unicode', 'stylesheets': stylesheets, 'sources': source_info, 'files': records}, ensure_ascii=False, indent=2) + '\n')
    for filename in ('fonts-core.css', extended_name, loader_name, 'manifest.json'):
        (OUT / filename).chmod(0o644)
    for old in [*OUT.glob('fonts-extended.*.css'), *OUT.glob('fonts-loader.*.js'), OUT / 'fonts.css']:
        if old.name not in (extended_name, loader_name) and old.exists():
            old.unlink()
    # Only the Latin face and UI core are essential on every route.
    html_path = ROOT / 'index.html'
    html = html_path.read_text()
    for key in ('latin-core', 'sans-core'):
        filename = next(r['file'] for r in records if r['file'].startswith(key + '.'))
        old_key = r'latin(?:-core)?' if key == 'latin-core' else key
        html = re.sub(r'/fonts/classhub/' + old_key + r'(?:\.[0-9a-f]+)?\.woff2', '/fonts/classhub/' + filename, html)
    extended_url = '/fonts/classhub/' + extended_name
    font_loading = '\n'.join([
        '    <!-- ClassHub extended fonts: generated by scripts/build-fonts.py -->',
        f'    <link rel="preload" href="{extended_url}" as="style" fetchpriority="low" />',
        f'    <link rel="stylesheet" href="{extended_url}" media="print" data-classhub-fonts="extended" />',
        f'    <script src="/fonts/classhub/{loader_name}" defer></script>',
        f'    <noscript><link rel="stylesheet" href="{extended_url}" /></noscript>',
        '    <!-- End ClassHub extended fonts -->',
    ])
    if '<!-- ClassHub extended fonts:' in html:
        html = re.sub(r'    <!-- ClassHub extended fonts:.*?<!-- End ClassHub extended fonts -->', lambda _: font_loading, html, flags=re.S)
    else:
        html = html.replace('    <!-- Favicon -->', font_loading + '\n\n    <!-- Favicon -->')
    html_path.write_text(html)
    print('TOTAL', sum(r['bytes'] for r in records), 'CORE', sum(r['bytes'] for r in records if 'core' in r['file']), flush=True)


if __name__ == '__main__':
    main()
