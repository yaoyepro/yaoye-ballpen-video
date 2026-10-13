# STYLE.md — the "ballpoint" look (default preset, locked)

Every film made with this skill looks the same: **one blue ballpoint pen drawing on cream lined notebook paper.**
The numbers below are the defaults in `presets/ballpoint.json` (read by `engine/core.js`, merged as
DEFAULTS ← preset ← project.json). They ARE the style; do not change them per project unless the user asks for a different look.
To make a variant, copy the preset to `presets/<name>.json` and set `"preset": "<name>"` in project.json.

## 1. Paper
| item | value |
|---|---|
| canvas | 1920×1080, everything in px of this canvas |
| paper colour | `#F5F0E2` (warm cream) + fine grain (`grain` 9) + faint blotches (`blotch` 6) |
| ruled lines | `rgba(110,150,205,.42)`, 1.6 px, first line y=150 (`rule_top`), every 44 px (`rule_gap`); `RULE(n)` = y of line n |
| red margin | `rgba(214,84,84,.62)`, 2.2 px, x=132 (`margin_x`). Nothing is written or drawn left of x≈140 |
| ground line | script mode: a full-width wobbly pen line at y≈1000 (`GROUND`) the scene stands on |

## 2. Inks (`palette`)
| pen | colour | used for |
|---|---|---|
| blue `b` | `#2440B8` | everything: outlines, hatching, handwriting, pen body |
| red `r` | `#C23038` | accents only: mouths/blush, hearts, title underline, sunrise/sun accents, a few dots |
| green `g` | `#1F8A4C` | accents only: plants, leaves, clothing motifs, small marks |
Rule of thumb: ≥ 85 % of ink is blue; red/green are 1–3 small touches per page.

## 3. Ballpoint line quality (`style.stroke`)
- base width **2.3 px**, alpha **.9**
- width varies along the stroke with value noise: × (0.78 + 0.44·noise), noise freq .04 /px
- alpha varies: × (0.68 + 0.32·noise), freq .025 /px (ballpoint skipping)
- taper at both ends over **10 px** down to **45 %** width (pen lands and lifts)
- drawn in **9 px** segments; resampled every **6 px**; hand wobble ±1.0 px at freq .03
- ink blobs: with p=**.07** per stroke start/end a dot r = 1.15·w, alpha .85
- traced character line art: width **3.2**, alpha .93, wobble .5; red lines 2.2/.9; green accents 2.0/.9

## 4. Four-layer hatching (`style.hatch`)
Parallel strokes ≤ **110 px** long, width 1.6, alpha .72, rows jittered (18 % of spacing), mid-points ±1.6 px.
| layer | angle | spacing | when |
|---|---|---|---|
| 1 | 52° | 7.5 px | every shaded area (lightest tone) |
| 2 | −38° | 6.5 px | mid tones / the shadow half of a doodle |
| 3 | 8° | 5.0 px | dark tones, night sky |
| 4 | 95° | 4.6 px | darkest tones only |
Hatching never crosses text (text halo `softLy`), keeps a glow around light sources (`softGlow`) and stays off a drawing's
own outlines (`strokeMask`). Background hatching (“sky” halo, “night” cross-hatch) is drawn last on a page.

## 5. Handwriting (`style.text`)
- font: **Yozai** (OFL, bundled `fonts/Yozai-Regular.ttf`; CJK + Latin). Other scripts: add an OFL handwriting font.
- size 60 (script-mode titles 76–84, text-only pages 84); per-glyph size jitter ±16 %, rotation ±0.157 rad,
  baseline jitter .11/.06 of size, line slope .035, tracking .98 ± .12, ink alpha .8 ± .2
- writing speed **0.1 s per character**, clamped to 0.62–1.35 s per line (song mode) / reading speed in script mode
- text sits ON a ruled line (baseline = `RULE(n)`), high on the page, never in the margin

## 6. The pen (`style.pen`)
A realistic ballpoint (blue barrel, metal tip) always visible while drawing: angle −1.08 rad, 600 px long, tip exactly on the
point being drawn, fades out after 0.4 s idle, hidden during flips/erasers. **One pen:** tasks never overlap; the pen is idle
≥ 0.3 s before any eraser or flip (`build` warns otherwise).

## 7. Transitions (`style.transitions`)
| transition | time | look |
|---|---|---|
| page flip | 0.5 s | the sheet turns over, revealing the next (prepared) sheet |
| page eraser (big) | 0.8 s | a large eraser rubs across the page; faint residue remains |
| small eraser | 0.5 s | a pencil eraser rubs out only the text lines; the drawing stays and new text is written |

## 8. Motion (`style.motion`)
Finished drawings keep breathing, never jittering: scale ±1.1 % over 3.2 s; sway/pulse/twinkle/drift with periods ≥ 0.9 s;
self-check fails anything reversing direction more than 6×/s. No line “boiling”, no frame swapping.

## 9. Composition
- Text top-left (or right/top), 1–4 lines, ruled-line aligned; the main drawing big (up to ~600 px) standing on the ground line.
- One main drawing per sheet + 1–3 small doodle extras; leave ≥ 35 % of the paper empty.
- Characters (if any) are traced from real images (`prep`), never drawn in code and never mirrored.
