# BKAi landing page and film

The public page for BKAi. It is a static site built with Vite, React 19, Tailwind v4 and framer-motion, designed to
[`Landing Page_DESIGN.md`](../Landing%20Page_DESIGN.md) ("sunlit research desk") and the brand in [`brand/BRAND.md`](../brand/BRAND.md).

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # static site in dist/ (deploy anywhere: Vercel, Netlify, nginx)
```

Or run it with the app: `scripts/start.sh --landing`.

## Sections

| Section | Component | Motion |
|---|---|---|
| Hero | `Hero.tsx`, `LiveDemo.tsx`, `Atmosphere.tsx` | headline masks in word by word; a real answer replays live in the DOM (typing → agents → streamed answer → verified); a painted sky with drifting clouds sits behind it; the window flattens from a 14° tilt on scroll |
| The maker | `Maker.tsx` | portrait opens with a clip-path reveal, parallax inside the frame |
| Background | `Story.tsx` | problem / approach / result, and the v1 → v5 journey with a scroll-drawn progress line |
| Product | `Showcase.tsx`, `Devices.tsx` | six real screens in a MacBook, with a slow camera push toward the feature, numbered callouts and auto-advance |
| Features and film | `Features.tsx` | the 60-second film, then 15 features, each with its metric and references |
| Evidence | `Metrics.tsx` | KPI strip and five tables (versions, accuracy, latency, retrieval, techniques) with 23 numbered references |
| Early feedback | `Closing.tsx` | **sample quotes, labelled as placeholders**: replace them in `content.ts` with real pilot feedback (with permission) |

All copy, numbers and references live in `src/content.ts`. Every metric cites the report that produced it in
`backend/evaluation/reports/`. `prefers-reduced-motion` turns the motion off.

Screens come from the running app: `cd backend && .venv/bin/python ../landing/scripts/capture_ui.py`, with `scripts/start.sh` running.

## The film (`video/`)

A 59-second film at 1080p60, in English, voiced by a cheerful female Kokoro voice (`af_heart` 0.65 + `af_bella` 0.35).
The score is synthesized in code (F major, 104 BPM), with no samples to license, and mixed to −14 LUFS.

| Act | Lines | Picture |
|---|---|---|
| Hook | h1–h3 | the source dot; real cut-offs float in; 74 codes · 9 programs · a cut-off line for code 142 (2023–2026) |
| Reveal | r1–r2 | every number converges into the dot; the brackets close into the BKAi mark |
| Product | f1–f6 | a MacBook rises over the painted field: typed question → agents → cited answer with the source card → voice with barge-in → calculator → trace |
| Proof | n1–n3 | 8/8 cases · 40/40 numbers · 15× faster |
| End | e1–e2 | "Every number has a source." |

Rebuild:

```bash
# 1. Voice. Needs an env with `kokoro` and `misaki[en]`; on macOS set ESPEAK_DATA_PATH if espeak-ng data is not found
ESPEAK_DATA_PATH=/opt/homebrew/share/espeak-ng-data <kokoro-venv>/bin/python video/voiceover.py
# 2. Frames, score, mix and encodes (Playwright + ffmpeg)
cd ../backend && .venv/bin/python ../landing/video/render.py --fps 60 --audio-python <kokoro-venv>/bin/python
#    --preview renders at 30 fps; --subs writes a captioned cut for muted autoplay
```

Outputs:
- `public/media/trailer/`: `bkai-trailer-web.mp4` (1600 px), `bkai-trailer-mobile.mp4` (720p), poster, `.vtt` and `.srt` captions.
- `video/build/`: the 1080p60 master (git-ignored).

To change a line, edit `video/script.json` (the spoken text, with `say` for spelling such as "B. K. A. I."), regenerate the
voice and re-render. Scene timing follows the voice automatically.
