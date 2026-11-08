#!/usr/bin/env python3
"""Append a content hash (?v=...) to every local asset URL in site/index.html and site/styles.css.

The server caches images and fonts for 30 days (immutable), and Cloudflare caches them at the
edge, so replacing a file under the same URL leaves visitors on the old copy. A hash in the URL
changes whenever the file changes, which makes both caches fetch the new one. Run after editing
anything under site/, before deploying:

    python3 tools/site/stamp-assets.py
"""
import hashlib
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"
ORIGIN = "https://decima.kgb-record.cloud/"


def digest(rel: str) -> str:
    return hashlib.sha1((SITE / rel).read_bytes()).hexdigest()[:8]


def stamp_css() -> None:
    p = SITE / "styles.css"
    css = re.sub(
        r"url\((assets/fonts/[^)?]+)(?:\?v=[0-9a-f]+)?\)",
        lambda m: f"url({m.group(1)}?v={digest(m.group(1))})",
        p.read_text(),
    )
    p.write_text(css)


def stamp_html() -> int:
    p = SITE / "index.html"
    html = p.read_text()
    html = re.sub(
        r'\b(src|href)="((?:assets/[^"?]+)|styles\.css|main\.js)(?:\?v=[0-9a-f]+)?"',
        lambda m: f'{m.group(1)}="{m.group(2)}?v={digest(m.group(2))}"',
        html,
    )
    html = re.sub(
        r'content="' + re.escape(ORIGIN) + r'(assets/[^"?]+)(?:\?v=[0-9a-f]+)?"',
        lambda m: f'content="{ORIGIN}{m.group(1)}?v={digest(m.group(1))}"',
        html,
    )
    p.write_text(html)
    return len(re.findall(r"\?v=[0-9a-f]{8}", html))


if __name__ == "__main__":
    stamp_css()  # first: styles.css is itself referenced (and hashed) from the page
    print("stamped", stamp_html(), "URLs in site/index.html")
