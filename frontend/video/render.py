"""Render the BKAi film: frames from trailer.html, Kokoro voice + synthesized score, English captions.

    1. <kokoro venv>/bin/python landing/video/voiceover.py        → build/vo_raw.wav, build/timeline.json
    2. backend/.venv/bin/python landing/video/render.py [--fps 60] [--preview] [--subs] [--audio-python PATH]

Outputs landing/public/media/trailer/: bkai-trailer-web.mp4 (site, desktop), bkai-trailer-mobile.mp4 (phones),
bkai-trailer.jpg (poster), bkai-trailer.vtt / .srt (captions); the 1080p60 master stays in build/.
--subs burns the captions in → build/bkai-trailer-captioned.mp4 (for muted autoplay on social feeds).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
OUT = HERE.parent / "public" / "media" / "trailer"
FRAMES = Path(tempfile.gettempdir()) / "bkai-trailer-frames"
WEB = ["-pix_fmt", "yuv420p", "-movflags", "+faststart", "-tag:v", "avc1"]


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def srt_time(s: float) -> str:
    ms = round(s * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


async def frames(fps: int, subs: bool, quality: int) -> tuple[float, list, float]:
    shutil.rmtree(FRAMES, ignore_errors=True)
    FRAMES.mkdir(parents=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", args=["--allow-file-access-from-files"])
        page = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        await page.goto((HERE / "trailer.html").as_uri() + ("?subs=1" if subs else ""), wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(400)
        info = await page.evaluate("({ duration: window.TRAILER.duration, cues: window.TRAILER.cues })")
        total = round(info["duration"] * fps)
        t0 = time.time()
        for f in range(total):
            await page.evaluate(f"window.TRAILER.render({f / fps})")
            await page.screenshot(path=str(FRAMES / f"{f:05}.jpg"), type="jpeg", quality=quality)
            if f % (fps * 5) == 0:
                print(f"\r  frames {f}/{total}", end="", flush=True)
        await b.close()
    print(f"\r  frames {total}/{total} ({time.time() - t0:.0f}s)")
    return info["duration"], info["cues"], time.time() - t0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--subs", action="store_true")
    ap.add_argument("--audio-python", default=sys.executable, help="python with numpy, scipy, soundfile")
    args = ap.parse_args()
    fps = 30 if args.preview else args.fps

    tl = json.loads((BUILD / "timeline.json").read_text())
    (BUILD / "timeline.js").write_text(f"window.TIMELINE={json.dumps(tl)};\n")
    OUT.mkdir(parents=True, exist_ok=True)

    duration, cues, _ = asyncio.run(frames(fps, args.subs, 80 if args.preview else 93))
    (BUILD / "cues.json").write_text(json.dumps(cues))
    subprocess.run([args.audio_python, str(HERE / "audio.py")], check=True)

    srt = "\n".join(f"{i + 1}\n{srt_time(l['start'])} --> {srt_time(l['end'] + 0.25)}\n{l['text']}\n" for i, l in enumerate(tl["lines"]))
    (OUT / "bkai-trailer.srt").write_text(srt)
    vtt = "WEBVTT\n\n" + "\n".join(f"{srt_time(l['start']).replace(',', '.')} --> {srt_time(l['end'] + 0.25).replace(',', '.')} line:85%\n{l['text']}\n" for l in tl["lines"])
    (OUT / "bkai-trailer.vtt").write_text(vtt)

    name = "bkai-trailer-captioned" if args.subs else "bkai-trailer-1080p60"
    master = BUILD / f"{name}.mp4"
    soft_subs = [] if args.subs else ["-i", str(OUT / "bkai-trailer.srt")]
    ff("-framerate", str(fps), "-i", str(FRAMES / "%05d.jpg"), "-i", str(BUILD / "mix.wav"), *soft_subs,
       "-map", "0:v", "-map", "1:a", *([] if args.subs else ["-map", "2:s", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng"]),
       "-c:v", "h264_videotoolbox", "-b:v", "8M" if args.preview else "16M", "-profile:v", "high", *WEB,
       "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
       "-t", f"{duration:.3f}", str(master))
    print("  master →", master)
    if args.subs:
        return

    def cut(width: int, kbps: int, profile: str, akbps: int, out: str) -> None:
        ff("-i", str(master), "-map", "0:v", "-map", "0:a", "-vf", f"scale={width}:-2:flags=lanczos,fps=30",
           "-c:v", "h264_videotoolbox", "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.35)}k", "-profile:v", profile, *WEB,
           "-c:a", "aac", "-b:a", f"{akbps}k", "-ac", "2", str(OUT / out))
        print("  cut →", OUT / out)

    cut(1600, 3200, "high", 160, "bkai-trailer-web.mp4")
    cut(1280, 1700, "main", 128, "bkai-trailer-mobile.mp4")
    poster_t = next(l for l in tl["lines"] if l["id"] == "r2")["start"] + 0.95
    shutil.copy(FRAMES / f"{round(poster_t * fps):05}.jpg", BUILD / "poster.jpg")
    ff("-i", str(BUILD / "poster.jpg"), "-vf", "scale=1600:-2", "-q:v", "3", str(OUT / "bkai-trailer.jpg"))
    print("done")


if __name__ == "__main__":
    main()
