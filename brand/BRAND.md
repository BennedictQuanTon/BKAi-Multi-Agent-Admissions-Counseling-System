# BKAi brand

## Idea

**The Bách Khoa cube that speaks.** An isometric cube in three Bách Khoa blues, with three ideas in one mark:
- a block of knowledge, echoing the cube language people associate with Bách Khoa;
- a chat tail on its lower face, because it is a counselor that talks;
- a four-point spark on its top face, for AI.

This is an original mark for an independent student project. It is **not** the HCMUT logo and must never be used as or
next to it in a way that suggests the university endorses BKAi.

- **Name:** BKAi (spoken "B-K-A-I"). The wordmark sets **BK** in navy and **Ai** in Bách Khoa blue.
- **Line:** *Every number has a source.*
- **Descriptor:** Admissions answers, grounded in the source.
- **Voice:** calm, precise, warm. Every claim carries a number, and every number a source. No hype words.

## Mark

| File | Use |
|---|---|
| `bkai-mark.svg` | Primary mark on light backgrounds. App icon, favicon, avatars |
| `bkai-mark-light.svg` | On navy or dark backgrounds |
| `bkai-lockup.png` | Mark and wordmark (README header) |

- **Construction:** 64-unit grid.
  - Faces: top `#3aa0f0`, left (with the chat tail) `#0d2f86`, right `#1f6fe0`.
  - White seams 1.6 units wide.
  - Spark centred on the top face at (32, 17.6).
- **Clear space:** a quarter of the mark's width. **Minimum size:** 16 px; the seams and spark may drop below 20 px.
- **Don'ts:** never recolour the faces, rotate the cube, put it inside the HCMUT emblem, or add a container tile.

## Colour

| Token | Hex | Role |
|---|---|---|
| Navy | `#0d2f86` | "BK", the left face, deep accents |
| Bách Khoa blue | `#1f6fe0` | "Ai", links, citations, primary buttons on the landing |
| Sky | `#3aa0f0` | Top face, highlights in the film |
| App brand | `#1d5fd1` | In-app selection and active states (white text ≥ 4.5:1) |
| Chart blue | `#2b74e4` | Chart marks (validated: lightness band, chroma, ≥ 3:1 on parchment) |
| Ink | `#1d1d1f` | Landing text |
| Canvas | `#fdfcfb` / Cloud `#f5f5f7` | Landing surfaces |

The app keeps the DESIGN.md structure (parchment, hairlines, compact type), but its single accent is now the Bách Khoa blue.

## Type

- **Display:** Instrument Sans 500, tight tracking (about −0.03 em).
- **Text and UI:** Inter (variable, self-hosted).
- **Numbers:** tabular figures wherever numbers are compared.

## Motion

- **Assemble:** the three faces fly in from their own directions (top from above, sides from the sides, staggered 0.1 s, expo-out); then the seams draw and the spark springs in with a quarter turn.
- **Match cut:** in the film, the assembled logo flies into the same logo in the app's sidebar, and the product takes over.
- **Reveal from the source:** content rises and un-blurs with `cubic-bezier(0.16, 1, 0.3, 1)` over 0.9 s.
- **Respect `prefers-reduced-motion`:** the landing turns all of the above off.

## Sound (film)

- **Voice:** Kokoro-82M, blending `af_heart` 0.65 and `af_bella` 0.35.
- **Score:** F major, I–V–vi–IV at 104 BPM, synthesized in code (`frontend/video/audio.py`).
- **Mix:** −14 LUFS.
