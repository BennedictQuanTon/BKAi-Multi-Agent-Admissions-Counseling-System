"""Capture README screenshots of the running app (frontend :5173 → backend).

    cd backend && .venv/bin/python ../docs/diagrams/screenshots.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from optimize import optimize
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent.parent / "image"
URL = "http://localhost:5173"


async def ask(page, q: str) -> None:
    await page.fill("textarea", q)
    await page.keyboard.press("Enter")
    await page.wait_for_selector("text=/kiểm chứng|cache đã duyệt|Có số liệu/", timeout=90_000)
    await page.wait_for_timeout(1500)


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        desk = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)

        land = await b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        await land.goto(URL, wait_until="networkidle")
        await land.wait_for_timeout(2500)
        await land.screenshot(path=OUT / "UI_Landing.png")

        await desk.goto(f"{URL}/chat", wait_until="networkidle")
        await desk.wait_for_timeout(1500)
        await desk.screenshot(path=OUT / "UI_Home.png")

        await ask(desk, "Mình được khoảng 80 điểm xét tuyển tổng hợp, thích AI và máy tính. Nên chọn ngành nào?")
        await desk.click("text=Cách BKAi tìm câu trả lời")
        await desk.wait_for_timeout(900)
        await desk.screenshot(path=OUT / "UI_Answer_Agent_Trace.png")

        await ask(desk, "Còn học phí chương trình tiếng Anh thì sao?")
        await desk.screenshot(path=OUT / "UI_Answer_Multiturn.png")

        tall = await b.new_page(viewport={"width": 1440, "height": 1500}, device_scale_factor=2)
        await tall.goto(f"{URL}/counselor", wait_until="networkidle")
        await tall.click("text=Tính điểm & gợi ý")
        await tall.wait_for_timeout(1500)
        await tall.evaluate("document.querySelector('main .overflow-y-auto').scrollTo(0, 900)")
        await tall.wait_for_timeout(600)
        await tall.screenshot(path=OUT / "UI_Counselor.png")

        await tall.goto(f"{URL}/voice", wait_until="networkidle")
        await tall.wait_for_timeout(800)
        await tall.screenshot(path=OUT / "UI_Voice.png", clip={"x": 0, "y": 0, "width": 1440, "height": 900})

        await tall.goto(f"{URL}/dashboard", wait_until="networkidle")
        await tall.click("button:has-text('Đánh giá')")
        await tall.wait_for_timeout(1800)
        await tall.screenshot(path=OUT / "UI_Dashboard_Benchmarks.png")

        obs = await b.new_page(viewport={"width": 1600, "height": 2350}, device_scale_factor=2)
        await obs.goto(f"{URL}/chat", wait_until="networkidle")
        await obs.click("button[aria-label='Mở Observability']")
        await obs.wait_for_timeout(3500)
        await obs.screenshot(path=OUT / "UI_Observability.png")
        await obs.evaluate("""() => {
          const h = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Lịch sử truy vết');
          let card = h; while (card && !card.querySelector('button.grid')) card = card.parentElement;
          const rows = [...card.querySelectorAll('button.grid')];
          (rows.find((r) => r.textContent.includes('80 điểm')) || rows[0]).click();
        }""")
        await obs.wait_for_timeout(2500)
        await obs.screenshot(path=OUT / "UI_Observability_Query_Trace.png", clip={"x": 600, "y": 0, "width": 1000, "height": 1740})

        mob = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=3)
        await mob.goto(f"{URL}/chat", wait_until="networkidle")
        await mob.wait_for_timeout(1200)
        await mob.screenshot(path=OUT / "UI_Mobile.png")
        await b.close()
        for shot in sorted(OUT.glob("UI_*.png")):
            optimize(shot)
        print("✓ screenshots →", OUT)


if __name__ == "__main__":
    asyncio.run(main())
