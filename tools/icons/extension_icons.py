#!/usr/bin/env python3
"""Generate the Decima toolbar / store icons (public/icon/*.png).

Pure standard library: no Pillow, no network. Usage:

    python3 tools/icons/extension_icons.py            # writes public/icon/{16,32,48,96,128}.png
    python3 tools/icons/extension_icons.py --out DIR  # write somewhere else
"""
import argparse
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIZES = (16, 32, 48, 96, 128)
BLURPLE = (88, 101, 242, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def in_arrow(cx: float, cy: float) -> bool:
    """Up-arrow glyph in unit coordinates (-1..1): a shaft plus a triangular head."""
    shaft = abs(cx) < 0.12 and -0.5 < cy < 0.45
    head = (
        cy < -0.05
        and cy > -0.55
        and abs(cx) < 0.55
        and abs(cx) < 0.5
        and (-cy - 0.05) > abs(cx) - 0.45
        and abs(cx) < cy + 0.6
    )
    return shaft or head


def pixel(x: int, y: int, size: int) -> tuple:
    half = size / 2
    cx, cy = (x - half) / half, (y - half) / half
    if cx * cx + cy * cy > 0.9:  # outside the round badge
        return CLEAR
    return WHITE if in_arrow(cx, cy) else BLURPLE


def chunk(tag: bytes, data: bytes) -> bytes:
    body = struct.pack(">I", len(data)) + tag + data
    return body + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def render_png(size: int) -> bytes:
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixel(x, y, size)) for x in range(size)) for y in range(size)
    )
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "icon")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = args.out / f"{size}.png"
        path.write_bytes(render_png(size))
        print("wrote", path.relative_to(ROOT) if path.is_relative_to(ROOT) else path)


if __name__ == "__main__":
    main()
