#!/usr/bin/env python3
"""Generate the Ephemera logo and button icons (assets/ephemera/*.svg).

Logo: a solid disc dissolving into dots that shrink and fade, "what vanishes, kept". Lime on
the same near-black badge as Decima, so the two read as siblings with different marks.

Each icon is an ink glyph on a lime rounded chip, so it reads on the white page buttons and on
the dark story overlays alike. The three SVGs are inlined into the content scripts at build time
(see lib/ephemera/icon-urls.ts), so the page never needs extra network requests.

    python3 tools/icons/ephemera_icons.py             # writes assets/ephemera/
    python3 tools/icons/ephemera_icons.py --preview   # also writes .wxt/icon-preview.html
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIME = "#c8ff3d"
INK = "#0c0c0e"


def chip_svg(body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
        f'<rect x="0.5" y="0.5" width="23" height="23" rx="7.5" fill="{LIME}"/>'
        f'<g fill="none" stroke="{INK}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">{body}</g>'
        "</svg>\n"
    )


def logo_svg() -> str:
    """Badge + disc + three fading dots. Pure geometry, no text."""
    dots = (
        '<circle cx="0.30" cy="0" r="0.15" opacity=".80"/>'
        '<circle cx="0.56" cy="0" r="0.10" opacity=".52"/>'
        '<circle cx="0.76" cy="0" r="0.06" opacity=".30"/>'
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2">'
        '<rect x="-0.94" y="-0.94" width="1.88" height="1.88" rx="0.44" fill="#0c0c0e" stroke="#3a3a42" stroke-width="0.06"/>'
        f'<g fill="{LIME}"><circle cx="-0.34" cy="0" r="0.42"/>{dots}</g></svg>\n'
    )


ICONS = {
    "logo": logo_svg(),
    # single download: shaft fading in from a dotted start, chevron head, base line
    "download": chip_svg(
        '<path d="M12 6.5v8"/><path d="m8 11 4 4 4-4"/><path d="M7 18.5h10"/>'
        f'<circle cx="12" cy="4" r="0.4" fill="{INK}"/>'
    ),
    # bulk download: two stacked chevrons over a base line
    "download-all": chip_svg(
        '<path d="m8 5.5 4 4 4-4"/><path d="m8 10.5 4 4 4-4"/><path d="M7 18.5h10"/>'
    ),
    # spinner: faint ring plus an ink arc that turns (SMIL animation, no JS needed)
    "loader": (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
        f'<rect x="0.5" y="0.5" width="23" height="23" rx="7.5" fill="{LIME}"/>'
        f'<g fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round">'
        '<circle cx="12" cy="12" r="6" opacity=".22"/>'
        '<path d="M12 6a6 6 0 0 1 6 6"><animateTransform attributeName="transform" type="rotate" '
        'from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></path></g></svg>\n'
    ),
}


def write_preview(path: Path) -> None:
    def cell(name: str, svg: str, bg: str, fg: str) -> str:
        big = svg.replace("<svg ", "<svg width=72 height=72 ", 1)
        small = svg.replace("<svg ", "<svg width=22 height=22 ", 1)
        return (
            f'<figure><div class="tile" style="background:{bg}">{big}'
            f'<span class="pill">{small}</span></div><figcaption style="color:{fg}">{name}</figcaption></figure>'
        )

    cells = "".join(
        cell(name, svg, bg, fg)
        for bg, fg in (("#ffffff", "#333"), ("#1b1b1f", "#bbb"))
        for name, svg in ICONS.items()
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "<!doctype html><meta charset=utf-8><title>Ephemera icons</title>"
        "<style>body{font:13px system-ui;background:#888;display:grid;grid-template-columns:repeat(3,auto);"
        "gap:16px;padding:24px;width:max-content}figure{margin:0;text-align:center}"
        ".tile{border-radius:18px;padding:18px;display:flex;gap:14px;align-items:center;justify-content:center}"
        ".pill{background:#fff;border-radius:30px;padding:7px;display:inline-flex;opacity:.9}"
        "</style>" + cells
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
