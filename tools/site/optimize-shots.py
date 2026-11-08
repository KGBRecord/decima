#!/usr/bin/env python3
"""Convert the captured PNG screenshots in site/assets/shots/ to WebP (the format the page ships).

    python3 tools/site/optimize-shots.py          # needs Pillow: pip install pillow
"""
from pathlib import Path
from PIL import Image

SHOTS = Path(__file__).resolve().parents[2] / "site" / "assets" / "shots"
for png in sorted(SHOTS.glob("*.png")):
    out = png.with_suffix(".webp")
    Image.open(png).convert("RGB").save(out, "WEBP", quality=86, method=6)
    print(f"{png.name} -> {out.name} ({png.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB)")
    png.unlink()
