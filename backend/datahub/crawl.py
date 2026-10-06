"""Render official HCMUT pages (JS SPA) with headless Chrome and snapshot them."""

from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

from config.settings import SOURCES_DIR
from datahub.sources import SOURCES, Source
from utils.logger import get_logger

logger = get_logger(__name__)

# Content lives in <main id="app"><section>…</section></main>; header/footer are outside sections.
_EXTRACT_JS = """
() => {
  const main = document.querySelector('main#app') || document.body;
  const sections = Array.from(main.querySelectorAll('section'));
  const roots = sections.length ? sections : [main];
  const text = roots.map(s => s.innerText).join('\\n\\n');
  const tables = Array.from(main.querySelectorAll('table')).map(t =>
    Array.from(t.rows).map(r => Array.from(r.cells).map(c => ({t: c.innerText.trim(), cs: c.colSpan, rs: c.rowSpan}))));
  const links = Array.from(main.querySelectorAll('a[href]')).map(a => [a.innerText.trim().slice(0, 120), a.href]);
  return {text, tables, links, title: document.title};
}
"""


async def _render(page, src: Source, out_dir: Path) -> dict:
    await page.goto(src.url, wait_until="networkidle", timeout=60_000)
    await page.wait_for_timeout(1200)
    data = await page.evaluate(_EXTRACT_JS)
    html = await page.content()
    (out_dir / f"{src.slug}.html").write_text(html, encoding="utf-8")
    (out_dir / f"{src.slug}.txt").write_text(data["text"], encoding="utf-8")
    (out_dir / f"{src.slug}.tables.json").write_text(
        json.dumps(data["tables"], ensure_ascii=False), encoding="utf-8"
    )
    return {
        "slug": src.slug,
        "url": src.url,
        "topic": src.topic,
        "title": src.title,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(data["text"].encode("utf-8")).hexdigest(),
        "chars": len(data["text"]),
        "tables": len(data["tables"]),
        "links": data["links"][:200],
    }


async def crawl(snapshot: str | None = None, delay_s: float = 1.0) -> Path:
    from playwright.async_api import async_playwright

    out_dir = SOURCES_DIR / (snapshot or date.today().isoformat())
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="BKAi-datahub/5.0 (+admissions counselling research)")
        for src in SOURCES:
            try:
                entry = await _render(page, src, out_dir)
                manifest.append(entry)
                logger.info("crawled", slug=src.slug, chars=entry["chars"], tables=entry["tables"])
            except Exception as e:  # keep going; a missing page is reported in the manifest
                manifest.append({"slug": src.slug, "url": src.url, "error": str(e)})
                logger.warning("crawl_failed", slug=src.slug, error=str(e))
            await asyncio.sleep(delay_s)  # be polite to the university server
        await browser.close()

    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return out_dir


def latest_snapshot() -> Path:
    snaps = sorted(p for p in SOURCES_DIR.glob("*") if (p / "manifest.json").exists())
    if not snaps:
        raise FileNotFoundError("No crawl snapshot found. Run `python -m datahub crawl` first.")
    return snaps[-1]
