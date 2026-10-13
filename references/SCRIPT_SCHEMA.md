# SCRIPT_SCHEMA.md — `script.json` (script mode: theme / keywords / poem / article)

Authored by the running agent (or auto-generated for poems), validated and timed by `python bpmv.py script -p project.json`.
No timestamps are written by hand: times come from reading speed × `pace`, optionally scaled to `target_duration`.

```jsonc
{
  "version": 1,
  "input_mode": "theme",            // theme | keywords | copy | poem | article (copy/poem enable the verbatim checks)
  "title": "和太阳奔跑",              // title card, big handwriting; "" = doodles only
  "subtitle": "",                   // author / date / one short line under the title
  "pace": "normal",                 // calm (×1.2) | normal | lively (×0.85) — writing, drawing and hold times
  "mood": "bright, hopeful",        // overall mood words: AUTO music key/tempo + music_brief.md
  "target_duration": 30,            // optional seconds; all times scaled ×0.6–1.8 to land within ±10 %
  "title_card": {"doodles": ["sun"], "hold": 1.2},          // first doodle is drawn big & shaded
  "pages": [
    {
      "id": "p1",                                   // unique; used by scenes.js hooks
      "text": ["清晨，太阳敲我的窗"],                  // 1–4 lines; ≤ 12 CJK / 24 Latin chars ideal, > 16 units = error
      "layout": "text-left",                        // text-left | text-right | text-top | text-bottom | art-center | text-only
      "main": {"doodle": "sunrise", "size": null, "hatch": true},   // OR {"sprite": "my_run"} (project sprite, prepped)
      "extras": ["birds", {"name": "cloud", "size": 90}],          // 0–4 small doodles, auto-placed
      "background": "sky",                          // none | sky | wash | night | ground  or a list, e.g. ["wash","ground"]
      "transition": "flip",                         // how THIS page opens: flip | erase | small_erase (keeps previous drawing)
      "mood": "waking up",                          // optional, per section for music
      "hold": null,                                 // optional seconds to hold after drawing (default: reading time)
      "duration": null                              // optional minimum seconds for this page
    }
  ],
  "end_card": {"text": "一起奔跑吧", "doodles": ["hearts"], "transition": "erase", "hold": 1.8}
}
```

## Validation (`bpmv.py script`)
Errors (must fix): no pages; page without text and main; > 4 lines; line > 16 units (CJK char = 1, Latin = 0.45);
unknown layout/transition/background/doodle; first page `small_erase`; sprite not in project.json or not prepped;
poem lines missing or changed; copy text differs from the source; TODO markers left. Warnings: characters missing from the handwriting font, line > 12.5 units (written smaller), `main` on a `small_erase` page (ignored),
> 4 extras, > 20 pages, `target_duration` not reachable.

## Outputs
- `work/plan.json` — every page with `t0/t1`, `enter` transition, timed `steps` (`text`, `small_erase`, `main`, `extra`, `bg`)
- `work/timeline.json` — on-screen lines in the lyric-mode format (`LY`, `lyric()`, self-check work unchanged)
- `work/music_brief.md` — duration, mood, BPM, section table with hit points, mux command
- `scenes.js` — created from `templates/scenes.auto.js` (`autoBuild()`) if missing; never overwritten

## Copy rules per input mode (also printed into `work/script_brief.md`)
| mode | rules |
|---|---|
| theme | write ORIGINAL copy: 5–9 pages, 1–2 short lines each; arc = opening image → 2–4 development → turn → warm close; concrete images, not slogans |
| keywords | every keyword appears or is pictured at least once; 4–8 pages; connecting copy around them |
| copy | the user's own copy: every word VERBATIM and in order; only split into lines/pages (≤ 12 CJK per line) and drop line-end punctuation; checked char by char (spaces/punctuation ignored) |
| poem | every line VERBATIM (characters, punctuation, order); 1 line or couplet per page; title + author on the title card. `script --input poem` writes the script automatically — review doodles/layouts |
| article | condense to 6–12 pages of 1–3 short lines (≤ 14 CJK / 28 Latin); keep facts, numbers and names exact; never invent; one idea per page |

Complete, tested examples for every input type: [script-examples.md](script-examples.md).
