#!/usr/bin/env python3
"""Convert the captured PNG screenshots in site/assets/shots/ to WebP (the format the page ships).

    python3 tools/site/optimize-shots.py          # needs Pillow: pip install pillow
"""
from pathlib import Path
from PIL import Image

SHOTS = Path(__file__).resolve().parents[2] / "site" / "assets" / "shots"


def fill(im: Image.Image) -> tuple:
    """How far non-black content reaches across the image (0..1, 0..1). A shrunk capture reaches ~0.5."""
    w, h = im.size
    px = im.load()
    pts = [(x, y) for y in range(0, h, 4) for x in range(0, w, 4) if sum(px[x, y]) > 40]
    return (max(p[0] for p in pts) / w, max(p[1] for p in pts) / h) if pts else (0.0, 0.0)


bad = []
for png in sorted(SHOTS.glob("*.png")):
    im = Image.open(png).convert("RGB")
    fx, fy = fill(im)
    if fx < 0.9 or fy < 0.9:
        bad.append(f"{png.name}: content reaches only {fx:.0%} x {fy:.0%}")
if bad:
    raise SystemExit("refusing to convert, shrunk captures (re-run capture-screens.mjs):\n  " + "\n  ".join(bad))

for png in sorted(SHOTS.glob("*.png")):
    out = png.with_suffix(".webp")
    Image.open(png).convert("RGB").save(out, "WEBP", quality=86, method=6)
    print(f"{png.name} -> {out.name} ({png.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB)")
    png.unlink()
