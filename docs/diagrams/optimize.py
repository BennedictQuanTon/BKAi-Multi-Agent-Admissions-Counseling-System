"""Shrink README images so GitHub loads them fast on a phone.

    cd backend && .venv/bin/python ../docs/diagrams/optimize.py          # every PNG in docs/image
    (render.py and screenshots.py call it on what they write)

Diagrams stay PNG: 1600 px wide, 256 colours (flat fills, crisp text, ~150 KB).
UI screenshots become progressive JPEG at 2× their README display width (~30–200 KB).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "image"
DIAGRAM_WIDTH = 1600
UI_WIDTH = {"UI_Mobile": 690, "UI_Landing": 1600}  # everything else: 1000 (shown at 500 px)


def _fit(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS) if im.width > width else im


def optimize(path: Path) -> Path:
    im = Image.open(path).convert("RGB")
    if path.stem.startswith("Diagram_"):
        im = _fit(im, DIAGRAM_WIDTH).quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(path, optimize=True)
        return path
    out = path.with_suffix(".jpg")
    _fit(im, UI_WIDTH.get(path.stem, 1000)).save(out, quality=82, optimize=True, progressive=True)
    if out != path:
        path.unlink()
    return out


if __name__ == "__main__":
    for p in sorted(IMAGES.glob("*.png")) if len(sys.argv) < 2 else [Path(a) for a in sys.argv[1:]]:
        before = p.stat().st_size
        q = optimize(p)
        print(f"✓ {q.name}: {before // 1024} → {q.stat().st_size // 1024} KB")
