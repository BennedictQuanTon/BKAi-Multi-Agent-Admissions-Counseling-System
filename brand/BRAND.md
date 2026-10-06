# BKAi brand

## Idea

**The source dot.** A citation's brackets around the one fact that matters: `[•]`.
BKAi's promise is that every number it gives comes with its source. The mark says that before anyone reads a word.

- **Name:** BKAi (spoken "B-K-A-I"). BK is Bách Khoa, the everyday name for HCMUT.
- **Line:** *Every number has a source.*
- **Descriptor:** Admissions answers, grounded in the source.
- **Voice:** calm, precise, warm. Every claim carries a number, and every number a source. No hype words.

## Mark

| File | Use |
|---|---|
| `bkai-mark.svg` | Primary: graphite tile, eggshell brackets, Source Blue dot. App icon, favicon, avatars |
| `bkai-mark-light.svg` | On dark backgrounds |
| `bkai-symbol.svg` | Brackets and dot without the tile, for inline use at ≥ 20 px |
| `bkai-lockup.png` | Mark and wordmark (README header) |

- **Construction:** 32-unit grid. Tile radius 9; bracket stroke 2.4 with round caps, 3 units deep; dot radius 2.7 at the centre.
- **Clear space:** at least the tile's corner radius on every side.
- **Minimum size:** 16 px.
- **Don'ts:** never recolour the dot to anything other than Source Blue, never outline the tile, never rotate it.
- **Wordmark:** "BKAi" in Inter 600, tracking −0.02 em, set at 0.75× the mark's height and 10 px from it at 24 px.

## Colour

| Token | Hex | Role |
|---|---|---|
| Eggshell | `#fdfcfb` | Page canvas (landing) |
| Paper | `#f0f0ea` | Feature boxes, insets |
| Linen | `#e4ded3` | Hairlines, outlined badges |
| Graphite | `#2e2e2e` | Text, mark tile, primary buttons |
| Quiet | `#6a6972` | Secondary text |
| **Source Blue** | `#207dff` | The dot, links, citations, small active accents. Never a large fill |
| App Teal | `#016a71` | In-product selection and "verified" states (from DESIGN.md) |

The landing uses Eggshell and Graphite, with Source Blue for references. The product keeps its Perplexity-style
parchment and teal (`DESIGN.md`). The mark is the same everywhere.

## Type

- **Display:** Instrument Sans 500, tight tracking (−0.03 em), for headlines on the landing and in the film.
- **Text and UI:** Inter (variable), 400–600.
- **Numbers:** tabular figures wherever numbers are compared.

## Motion

- **Reveal from the source:** content rises 24 px and un-blurs from 8 px with an expo-out ease (`cubic-bezier(0.16, 1, 0.3, 1)`) over 0.9 s.
- **The dot lands last:** in the logo animation the brackets slide in first, then the dot springs in.
  In the film, every number on screen converges into the dot before the logo appears.
- **Scroll-linked, never scroll-jacked:** the product window flattens from a 14° tilt as it scrolls in.
- **Respect `prefers-reduced-motion`:** the landing turns all of the above off.

## Sound (film)

Voice: Kokoro-82M, a blend of `af_heart` 0.65 and `af_bella` 0.35. Score: F major, I–V–vi–IV at 104 BPM, synthesized in
code (`landing/video/audio.py`). Mixed at −14 LUFS.
