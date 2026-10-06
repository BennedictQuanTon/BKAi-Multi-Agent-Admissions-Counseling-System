# Landing page and film

The landing page is part of the app: `src/landing/` renders at `/`, and **Try it** opens the counselor at `/chat`.
It follows [`Landing Page_DESIGN.md`](../../Landing%20Page_DESIGN.md), with Apple-style surfaces, and the brand in
[`brand/BRAND.md`](../../brand/BRAND.md). All copy, numbers and references live in `src/landing/content.ts`. Every
metric cites the report that produced it in `backend/evaluation/reports/`.

| Section | Component | Motion |
|---|---|---|
| Hero | `Hero.tsx`, `LiveDemo.tsx`, `Atmosphere.tsx` | headline masks in; a real answer replays in the DOM; painted sky; the window flattens on scroll |
| Proof and stack | `Proof.tsx` | four numbers, each with a micro-chart (cases, numbers, verified ring, v4 vs v5 speed); a double marquee of 27 technologies with their logos |
| Maker | `Maker.tsx` | portrait clip-path reveal; Top 10 award, 11 certifications, 5 hackathons |
| Background | `Story.tsx` | three Apple-style cards with live illustrations (cut-offs that move, agent flow, a verified answer) |
| Product | `Showcase.tsx`, `Devices.tsx` | six real screens in a MacBook with camera push and numbered callouts |
| Film and features | `Features.tsx` | the film plays muted when visible (sound, captions and pause toggles); a 15-tile bento |
| Evidence | `Metrics.tsx` | KPI strip, five tables, references |
| Early feedback | `Closing.tsx` | **sample quotes, labelled as placeholders**: replace them with real pilot quotes (with permission) |

Screens come from the running app: `cd backend && .venv/bin/python ../frontend/scripts/capture_ui.py`, with `./start.sh` running.

## The film

A 59-second film at 1080p60, in English, voiced by a cheerful female Kokoro voice (`af_heart` 0.65 + `af_bella` 0.35).
The score is synthesized in code (F major, 104 BPM) and mixed to −14 LUFS.

| Act | Picture |
|---|---|
| Hook | the dot; real cut-offs float in; 74 codes · 9 programs · a cut-off line for code 142 (2023–2026) |
| Reveal | every number converges into the spark; the cube's three faces assemble, the spark turns on, "BK·Ai" wipes in |
| Match cut | the logo flies into the same logo in the app's sidebar as the MacBook rises |
| Product | masked feature titles; screens push in and recede: question → agents → cited answer with its source card → voice with barge-in → calculator → trace |
| Proof | the benchmark totals, counted up |
| End | the cube assembles again: "Every number has a source." |

Rebuild:

```bash
# 1. Voice (env with `kokoro` + `misaki[en]` + en_core_web_sm; on macOS point espeak at Homebrew's data)
ESPEAK_DATA_PATH=/opt/homebrew/share/espeak-ng-data <kokoro-venv>/bin/python frontend/video/voiceover.py
# 2. Frames, score, mix and encodes (Playwright + ffmpeg)
cd backend && .venv/bin/python ../frontend/video/render.py --fps 60 --audio-python <kokoro-venv>/bin/python
```

Outputs:
- `frontend/public/media/trailer/`: `bkai-trailer-web.mp4`, `bkai-trailer-mobile.mp4`, poster, and `.vtt` / `.srt` captions.
- `frontend/video/build/`: the 1080p60 master (git-ignored).

To change a line, edit `script.json`; `say` sets the spoken spelling, e.g. "B. K. A. I.". Scene timing follows the voice.
