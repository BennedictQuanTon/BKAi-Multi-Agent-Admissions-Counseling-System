"""Capture the real BKAi app for the landing page and the trailer (MacBook screen = 1512 × 982 css px, @2x).

    scripts/start.sh                                   # app on :5173, API on :8000
    cd backend && .venv/bin/python ../frontend/scripts/capture_ui.py

Writes frontend/public/media/ui/*.jpg (landing page showcase + film). Asks two real questions, so it uses ~4 Gemini calls.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from playwright.async_api import Page, async_playwright

OUT = Path(__file__).resolve().parent.parent / "public" / "media" / "ui"
URL = "http://localhost:5173"
W, H = 1512, 982


async def ask(page: Page, q: str) -> None:
    await page.fill("textarea", q)
    await page.keyboard.press("Enter")
    await page.wait_for_selector("text=/kiểm chứng|cache đã duyệt|Có số liệu/", timeout=120_000)
    await page.wait_for_timeout(1500)


async def shot(page: Page, name: str, **kw) -> None:
    await page.screenshot(path=OUT / f"{name}.jpg", type="jpeg", quality=88, **kw)
    print("✓", name)


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        mac = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)

        await mac.goto(f"{URL}/chat", wait_until="networkidle")
        await mac.wait_for_timeout(1200)
        await shot(mac, "home")

        await ask(mac, "Mình được khoảng 80 điểm xét tuyển tổng hợp, thích AI và máy tính. Nên chọn ngành nào?")
        await mac.click("text=Cách BKAi tìm câu trả lời")
        # the chat transcript is the tallest scroll container on the page
        await mac.add_script_tag(content="window.CHAT = () => [...document.querySelectorAll('.overflow-y-auto')].sort((a, b) => b.scrollHeight - a.scrollHeight)[0];")
        await mac.wait_for_timeout(900)
        await mac.evaluate("CHAT().scrollTo(0, 0)")
        await mac.wait_for_timeout(500)
        await shot(mac, "answer-trace")
        await mac.evaluate("CHAT().scrollTo(0, CHAT().scrollHeight)")
        await mac.wait_for_timeout(700)
        await shot(mac, "answer-body")

        await mac.goto(f"{URL}/counselor", wait_until="networkidle")
        await mac.click("text=Tính điểm & gợi ý")
        await mac.wait_for_timeout(1600)
        await mac.evaluate("document.querySelector('main .overflow-y-auto')?.scrollTo(0, 620)")
        await mac.wait_for_timeout(700)
        await shot(mac, "counselor")

        await mac.goto(f"{URL}/voice", wait_until="networkidle")
        await mac.wait_for_timeout(1000)
        await shot(mac, "voice")

        await mac.goto(f"{URL}/dashboard", wait_until="networkidle")
        await mac.click("button:has-text('Đánh giá')")
        await mac.wait_for_timeout(1800)
        await shot(mac, "dashboard")

        await mac.goto(f"{URL}/chat", wait_until="networkidle")
        await mac.click("button[aria-label='Mở Observability']")
        await mac.wait_for_timeout(3500)
        await shot(mac, "observability")
        # history card renders when scrolled into view; open the newest question's trace
        await mac.evaluate("""() => {
          const box = document.querySelector('.rounded-cards.overflow-y-auto'); box && box.scrollTo(0, box.scrollHeight);
        }""")
        await mac.wait_for_timeout(1500)
        await mac.evaluate("""() => {
          const h = [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Lịch sử truy vết');
          let card = h; while (card && !card.querySelector('button.grid')) card = card.parentElement;
          const rows = [...card.querySelectorAll('button.grid')];
          (rows.find((r) => r.textContent.includes('80 điểm')) || rows[0]).click();  // the richest trace
        }""")
        await mac.wait_for_timeout(2500)
        await shot(mac, "trace")

        phone = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        await phone.goto(f"{URL}/chat", wait_until="networkidle")
        await ask(phone, "Học phí chương trình tiêu chuẩn năm 2026-2027 là bao nhiêu?")
        await phone.wait_for_timeout(800)
        await shot(phone, "mobile")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
