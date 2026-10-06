"""Render every docs/diagrams/*.html to docs/image/<name>.png (2× scale).

    cd backend && .venv/bin/python ../docs/diagrams/render.py [name ...]
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "image"


async def main(names: list[str]) -> None:
    files = sorted(p for p in HERE.glob("*.html") if not names or p.stem in names)
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        page = await browser.new_page(viewport={"width": 2400, "height": 1600}, device_scale_factor=2)
        for f in files:
            await page.goto(f.as_uri(), wait_until="networkidle")
            await page.wait_for_selector("body[data-ready='1']", timeout=30_000)
            await page.locator("#canvas").screenshot(path=str(OUT / f"{f.stem}.png"))
            print("✓", f.stem)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
