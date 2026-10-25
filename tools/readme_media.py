"""The README's moment clips: a captured clip on one side, its scale and caption on the other.

    python tools/readme_media.py [quark division ...]   ->  docs/media/<name>-<theme>-v4.avif / .webp

Drawn at 1840 px wide (about twice the README column, sharp on HiDPI screens), text included, from the
captured frames in tools/src/frames (1280 x 720 JPG at 30 fps). AVIF at 30 fps for the page; a lighter WebP
(920 px, 15 fps) for browsers without AVIF. Each theme is flattened onto GitHub's own background.
"""
import os, subprocess, sys, textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(ROOT, 'tools', 'src', 'frames')
OUT = os.path.join(ROOT, 'docs', 'media')
NM = os.path.join(ROOT, 'node_modules')
SERIF = NM + r'\@fontsource\instrument-serif\files\instrument-serif-latin-400-normal.woff2'
ITALIC = NM + r'\@fontsource\instrument-serif\files\instrument-serif-latin-400-italic.woff2'
MONO = NM + r'\@fontsource-variable\geist-mono\files\geist-mono-latin-wght-normal.woff2'

W, H = 960, 360            # layout units
CW, CH = 580, 326          # the clip
Z = 1840 / W               # px per unit
PW, PH = round(W * Z), round(H * Z)
FPS = 30
WEBP_W, WEBP_Q = 920, 70

THEMES = {
    'dark': dict(page=(13, 17, 23), ink=(236, 231, 219), dim=(236, 231, 219, 150), acc=(255, 91, 46)),
    'light': dict(page=(255, 255, 255), ink=(31, 29, 26), dim=(31, 29, 26, 160), acc=(214, 70, 28)),
}

MOMENTS = [
    # name, clip, start, count, crop, exponent, title, line
    ('quark', 'quark', 0, 120, (160, 90, 960, 540), '-15', 'Nobody has seen a quark alone',
     'Pull one away and the string between them snaps into new quarks.'),
    ('division', 'division', 0, 150, (160, 90, 960, 540), '-5', 'A cell divides',
     'Chromosomes split along the spindle: two nuclei, then a wall between them.'),
    ('earthrise', 'earthrise', 70, 80, (240, 110, 800, 450), '8', 'Earthrise',
     'From the Moon, home rises over a grey horizon.'),
    ('saturn', 'saturn2', 20, 95, (360, 202, 560, 315), '9', 'Saturn, edge on',
     'Rings twenty Earths wide and only metres thick.'),
    ('sgr', 'sgr2', 0, 100, (160, 90, 960, 540), '20', 'The heart of the galaxy',
     'Stars racing around Sagittarius A*, four million suns in one dark point.'),
    ('deep', 'deep2', 60, 70, (160, 90, 960, 540), '26', 'A grain of sand of sky',
     'Held at arm’s length, it hides thousands of galaxies.'),
]

def px(v):
    return round(v * Z)

def feather(w, h, p=3, inner=0.6):
    """A soft superellipse: 1 in the middle, 0 at the edges, no corners."""
    u = np.abs(np.linspace(-1, 1, w))[None, :]
    v = np.abs(np.linspace(-1, 1, h))[:, None]
    d = (u ** p + v ** p) ** (1 / p)
    t = np.clip((d - inner) / (1 - inner), 0, 1)
    return 1 - t * t * (3 - 2 * t)

def card(w, h, r=22):
    """Light theme: a crisp rounded card (anti-aliased by supersampling)."""
    im = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), px(r) * 4, fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255

def text_layer(exp, title, line, tx, th):
    f_t = ImageFont.truetype(SERIF, px(50))
    f_l = ImageFont.truetype(ITALIC, px(27))
    f_m = ImageFont.truetype(MONO, px(22))
    f_ms = ImageFont.truetype(MONO, px(14))
    tl = textwrap.wrap(title, 15)
    ll = textwrap.wrap(line, 30)
    block = 44 + 52 * len(tl) + 14 + 32 * len(ll)
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = (H - block) // 2
    # the scale, 10^exp m
    d.text((px(tx), px(y)), '10', font=f_m, fill=th['acc'])
    w = d.textlength('10', font=f_m)
    d.text((px(tx) + w + px(1), px(y - 9)), exp, font=f_ms, fill=th['acc'])
    w2 = d.textlength(exp, font=f_ms)
    d.text((px(tx) + w + w2 + px(9), px(y)), 'm', font=f_m, fill=th['acc'])
    y += 44
    for ln in tl:
        d.text((px(tx), px(y)), ln, font=f_t, fill=th['ink'])
        y += 52
    y += 14
    for ln in ll:
        d.text((px(tx), px(y)), ln, font=f_l, fill=th['dim'])
        y += 32
    return np.asarray(im, dtype=np.float32) / 255

def encode_avif(dst):
    return subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{PW}x{PH}', '-r', str(FPS), '-i', '-',
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
         '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:v', 'libsvtav1', '-preset', '5', '-crf', '34', '-g', '600', '-loop', '0', dst],
        stdin=subprocess.PIPE)

def moment(k, m):
    name, clip, start, count, crop, exp, title, line = m
    left = k % 2 == 0
    cw, ch = px(CW), px(CH)
    cx = 0 if left else PW - cw
    cy = (PH - ch) // 2
    tx = CW + 10 if left else 30
    x, y, w, h = crop
    idx = list(range(start, start + count))
    idx = idx + idx[-2:0:-1]  # ping-pong
    clips = {}
    def frame(i):
        if i not in clips:
            im = Image.open(os.path.join(FR, clip, f'{i:04d}.jpg')).crop((x, y, x + w, y + h)).resize((cw, ch), Image.LANCZOS)
            clips[i] = np.asarray(im, dtype=np.float32) / 255
        return clips[i]
    mask = feather(cw, ch)
    rounded = card(cw, ch)
    for theme, th in THEMES.items():
        page = np.array(th['page'], np.float32) / 255
        txt = text_layer(exp, title, line, tx, th)
        ta = txt[..., 3:4]
        dst = os.path.join(OUT, f'{name}-{theme}-v4')
        enc = encode_avif(dst + '.avif')
        webp = []
        for n, i in enumerate(idx):
            rgb = frame(i)
            if theme == 'dark':
                # screen over the page: black becomes the page, light stays light; feathered edges
                col, a = page + rgb * (1 - page), mask
            else:
                col, a = rgb, rounded
            out = np.empty((PH, PW, 3), np.float32)
            out[:] = page
            out[cy:cy + ch, cx:cx + cw] = col * a[..., None] + page * (1 - a[..., None])
            out = txt[..., :3] * ta + out * (1 - ta)
            img = Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8), 'RGB')
            enc.stdin.write(img.tobytes())
            if n % 2 == 0:
                webp.append(img.resize((WEBP_W, round(PH * WEBP_W / PW)), Image.LANCZOS))
        enc.stdin.close()
        enc.wait()
        webp[0].save(dst + '.webp', save_all=True, append_images=webp[1:], duration=2000 // FPS, loop=0, quality=WEBP_Q, method=4)
        print(f'  {name}-{theme}: {len(idx)} frames  avif {os.path.getsize(dst + ".avif") / 1e6:.2f} MB'
              f'  webp {os.path.getsize(dst + ".webp") / 1e6:.2f} MB', flush=True)

if __name__ == '__main__':
    which = sys.argv[1:]
    for k, m in enumerate(MOMENTS):
        if not which or m[0] in which:
            moment(k, m)
