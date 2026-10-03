"""对 4 段候选音频做基频(F0)分析：牛来=奶声高音，妈妈=成年低音，找出混入的那段。"""
import subprocess
import numpy as np

def load(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ar', '16000', '-ac', '1', '-f', 's16le', '-'],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0

def f0_track(x, sr=16000, fmin=90, fmax=900, win=0.03, hop=0.01):
    """自相关基频跟踪：返回每帧 F0（无声/清音帧为 0）。"""
    w, h = int(sr * win), int(sr * hop)
    lo, hi = sr // fmax, sr // fmin
    out = []
    for s in range(0, len(x) - w, h):
        seg = x[s:s + w]
        if np.sqrt(np.mean(seg ** 2)) < 0.01:  # 能量门限
            out.append(0.0)
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, mode='full')[len(seg) - 1:]
        if ac[0] <= 0:
            out.append(0.0)
            continue
        ac = ac / ac[0]
        lag = lo + int(np.argmax(ac[lo:hi]))
        out.append(sr / lag if ac[lag] > 0.25 else 0.0)
    return np.array(out)

for name in ['mama1', 'mama2', 'mama3', 'mama4']:
    x = load(f'/home/tenbox/Desktop/Devspace/dsh-niulai-pet/assets/{name}.mp3')
    f0 = f0_track(x)
    voiced = f0[f0 > 0]
    if len(voiced) == 0:
        print(f'{name}: 无浊音帧？')
        continue
    # 分两半看基频走向（喊声内部是否换人）
    mid = len(voiced) // 2
    print(f'{name}: 中位 {np.median(voiced):6.1f}Hz  均值 {voiced.mean():6.1f}Hz  '
          f'P10 {np.percentile(voiced,10):6.1f}  P90 {np.percentile(voiced,90):6.1f}  '
          f'前半 {voiced[:mid].mean():6.1f}Hz 后半 {voiced[mid:].mean():6.1f}Hz')
