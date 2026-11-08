#!/usr/bin/env python3
"""Generate the Decima toolbar / store icons (public/icon/*.png).

The mark: a thick ring with one opening, and a dot that has just left through it. A ring is a
channel, the dot is a file on its way out. Lime on near-black, the same two colors as the
project site. It is one construction at every size; only the proportions are tuned (a wider
opening and a thicker ring at 16 px) so the opening and the dot survive the pixel grid.

Pure standard library: no Pillow, no network. Usage:

    python3 tools/icons/extension_icons.py            # writes public/icon/{16,32,48,96,128}.png
    python3 tools/icons/extension_icons.py --out DIR  # write somewhere else
    python3 tools/icons/extension_icons.py --site     # also refresh site/assets favicon + brand icon
"""
import argparse
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIZES = (16, 32, 48, 96, 128)
INK = (12, 12, 14)
LIME = (200, 255, 61)
RIM = (58, 58, 66)  # hairline so the badge keeps its edge on dark toolbars
SS = 4  # supersampling: SS x SS samples per pixel
GAP_AT = 45.0  # opening centered at 1:30 on the clock, in degrees clockwise from 12 o'clock


def params(size: int) -> dict:
    """Same construction everywhere; only proportions change with size."""
    if size <= 16:
        return {"r_in": 0.27, "r_out": 0.66, "gap": 76.0, "dot_r": 0.19, "dot_at": 0.50, "rim": 0.0}
    if size <= 32:
        return {"r_in": 0.31, "r_out": 0.64, "gap": 64.0, "dot_r": 0.16, "dot_at": 0.50, "rim": 0.07}
    return {"r_in": 0.33, "r_out": 0.62, "gap": 54.0, "dot_r": 0.135, "dot_at": 0.50, "rim": 0.04}


def badge_distance(x: float, y: float, half: float = 0.94, radius: float = 0.44) -> float:
    """Signed distance to the rounded square in unit coordinates (negative = inside)."""
    qx, qy = abs(x) - (half - radius), abs(y) - (half - radius)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius


def sample(x: float, y: float, p: dict):
    """Color of one sub-sample: None (clear), INK, RIM or LIME."""
    d = badge_distance(x, y)
    if d > 0:
        return None
    if p["rim"] and d > -p["rim"]:
        return RIM
    r = math.hypot(x, y)
    ang = (math.degrees(math.atan2(y, x)) + 90.0) % 360.0  # 0 at 12 o'clock, clockwise
    # the dot sits in the opening, nudged outward like something that was just sent
    a = math.radians(GAP_AT - 90.0)
    cx, cy = p["dot_at"] * math.cos(a) * 1.0, p["dot_at"] * math.sin(a) * 1.0
    cx, cy = cx * 1.18, cy * 1.18
    if math.hypot(x - cx, y - cy) <= p["dot_r"]:
        return LIME
    if p["r_in"] <= r <= p["r_out"]:
        off = abs((ang - GAP_AT + 180.0) % 360.0 - 180.0)
        if off > p["gap"] / 2.0:
            return LIME
    return INK


def pixel(px: int, py: int, size: int, p: dict) -> tuple:
    acc_a = acc_r = acc_g = acc_b = 0
    for sy in range(SS):
        for sx in range(SS):
            u = ((px + (sx + 0.5) / SS) / size) * 2 - 1
            v = ((py + (sy + 0.5) / SS) / size) * 2 - 1
            c = sample(u, v, p)
            if c is not None:
                acc_a += 1
                acc_r += c[0]
                acc_g += c[1]
                acc_b += c[2]
    if not acc_a:
        return (0, 0, 0, 0)
    n = SS * SS
    return (acc_r // acc_a, acc_g // acc_a, acc_b // acc_a, round(255 * acc_a / n))


def chunk(tag: bytes, data: bytes) -> bytes:
    body = struct.pack(">I", len(data)) + tag + data
    return body + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def render_png(size: int) -> bytes:
    p = params(size)
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixel(x, y, size, p)) for x in range(size)) for y in range(size)
    )
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "icon")
    parser.add_argument("--site", action="store_true", help="also write site/assets favicon.png and icon-128.png")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rendered = {}
    for size in SIZES:
        path = args.out / f"{size}.png"
        rendered[size] = render_png(size)
        path.write_bytes(rendered[size])
        print("wrote", path.relative_to(ROOT) if path.is_relative_to(ROOT) else path)
    if args.site:
        site = ROOT / "site" / "assets"
        (site / "favicon.png").write_bytes(rendered[48])
        (site / "icon-128.png").write_bytes(rendered[128])
        print("wrote site/assets/favicon.png, site/assets/icon-128.png")


if __name__ == "__main__":
    main()
