#!/usr/bin/env python3
"""Generate the Ephemera button icons (assets/ephemera/*.svg).

The three SVGs are inlined into the content scripts at build time (see
lib/ephemera/icon-urls.ts), so the page never needs extra network requests.

    python3 tools/icons/ephemera_icons.py             # writes assets/ephemera/
    python3 tools/icons/ephemera_icons.py --preview   # also writes .wxt/icon-preview.html
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ACCENT = "#5865f2"  # Decima blurple


def stroke_svg(body: str, color: str = ACCENT, width: str = "2.2") -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
        f'stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">'
        f"{body}</svg>\n"
    )


ICONS = {
    # single download: continuous shaft, chevron head, tray line
    "download": stroke_svg(
        '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>'
    ),
    # bulk download: stacked chevrons over a tray line
    "download-all": stroke_svg(
        '<path d="m7.5 5 4.5 4.5L16.5 5"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>'
    ),
    # spinner: faint track plus a rotating arc (SMIL animation, no JS needed)
    "loader": (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
        f'stroke="{ACCENT}" stroke-width="2.6" stroke-linecap="round">'
        '<circle cx="12" cy="12" r="8" opacity=".18"/>'
        '<path d="M12 4a8 8 0 0 1 8 8"><animateTransform attributeName="transform" type="rotate" '
        'from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></path></svg>\n'
    ),
}


def write_preview(path: Path) -> None:
    cells = "".join(
        f'<figure><div class="tile">{svg.replace("<svg ", "<svg width=72 height=72 ", 1)}</div>'
        f"<figcaption>{name}</figcaption></figure>"
        for name, svg in ICONS.items()
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "<!doctype html><meta charset=utf-8><title>Ephemera icons</title>"
        "<style>body{font:13px system-ui;background:#f3f4f6;display:flex;gap:16px;padding:24px}"
        "figure{margin:0;text-align:center}.tile{background:#fff;border-radius:999px;padding:16px;"
        "box-shadow:0 1px 4px #0003}</style>" + cells
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=ROOT / "assets" / "ephemera")
    parser.add_argument("--preview", action="store_true", help="write an HTML contact sheet to .wxt/")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, svg in ICONS.items():
        path = args.out / f"{name}.svg"
        path.write_text(svg)
        print("wrote", path.relative_to(ROOT) if path.is_relative_to(ROOT) else path)
    if args.preview:
        preview = ROOT / ".wxt" / "icon-preview.html"
        write_preview(preview)
        print("preview", preview.relative_to(ROOT))


if __name__ == "__main__":
    main()
