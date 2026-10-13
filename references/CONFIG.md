# project.json reference

Paths are relative to the project folder; `@skill/...` points inside this skill package. Defaults live in `scripts/common.py`.

| key | default | meaning |
|---|---|---|
| `title` | "" | used by title/end card helpers (`CFG.title`) |
| `mode` | auto | `"song"` (audio + lyric sync) or `"script"` (script.json). Auto: song if `audio` is set, else script |
| `preset` | "ballpoint" | visual style preset `presets/<name>.json` (palette, paper, fonts, `style.*`) — see STYLE.md. Any key can be overridden here, but the defaults are the style |
| `script` | "script.json" | script-mode input (schema: SCRIPT_SCHEMA.md) |
| `music` | `{mode:auto-inferred, file:null, offset:0, fade_in:.5, fade_out:2, lufs:-16, engine:"synth", soundfont:null}` | `mode`: `song` \| `none` \| `external` (file or `bpmv.py mux --music`) \| `auto` (composed: `engine` synth \| fluidsynth (+`soundfont`) \| lyria (needs GEMINI_API_KEY)) |
| `foley` | `{enabled:false, level_db:-24}` | procedural pen-scratch / flip / eraser sounds (script template enables it) |
| `target_duration` | — | set in script.json, not here |
| `audio` | song mode only | song file (mp3/wav/flac/m4a) |
| `lyrics` | null | lyrics.txt, one sung line per row; `[Section]` rows set the section; blank lines ignored. Without it the ASR text is used (must be corrected by hand) |
| `language` | "zh" | whisper language code (`en`, `ja`, …; null = auto) |
| `lead_in` | 1.0 (script mode: 0) | silence before the song (title card). **video time = song time + lead_in** |
| `tail` | 0 | extra seconds after the song |
| `duration` | auto | override total length (`lead_in + song_duration + tail`) |
| `audio_fade_out` | 2.0 | music fade at the very end |
| `fps` / `phone_fps` | 60 / 30 | main render fps / phone version fps |
| `sample_seconds` | 25 | length of the approval sample |
| `scenes` | "scenes.js" | per-song scene script |
| `timeline_seed` | null | optional hand-written timeline file (same format as `work/timeline.json`, usually with `"locked": true`); copied to `work/timeline.json` on first use when that file does not exist. Used by `examples/demo` (a demo song without vocals) |
| `sprites_dir` | "sprites" | transparent character PNGs |
| `sprites` | {} | `{"name": {"height": 470, "file": "optional.png", "prep": {...overrides}}}` — display height in px on the 1080p canvas (typ. 380–520) |
| `fonts`, `hand_font`, `palette`, `paper`, `style` | from the preset | see STYLE.md for every value; override only on purpose |
| `logo` | null | `{"file","height":66,"right":58,"top":45,"ink":0.82,"recolor":true,"color":"b"}` corner mark, re-inked as ballpoint; pen and lyrics avoid it |
| `credits` | [] | lines for `credits(P,...)` |
| `asr` | large-v3, auto device, demucs on | `{"model","device":"auto|cpu|cuda","compute_type":"auto|int8|float16","demucs":true,"demucs_model":"htdemucs","beam_size":5,"prompt_with_lyrics":true}` |
| `prep` | see `scripts/prep.py` PREP_DEFAULTS | `dark_v` (line darkness), `layers` (lum/angle/spacing ×4), `red`, `skin`, `hairclip`, `accent` (`{"enabled":true,"base_hue":[30,90]}` = light/yellow motifs on clothes of that hue → green pen) |
| `render` | `{workers:0(auto), chunk_seconds:3, chunk_crf:14, main_crf:18, phone_crf:23}` | |
| `output_name` | "lyric_mv" | file stem in `out/` |

Generated folders: `work/` (song mode: song.wav, sep/, asr.json, beats.json, **timeline.json**, timeline_review.md; script mode: source.txt, script_brief.md, **plan.json**, timeline.json, music_brief.md; audio: foley.wav, music_auto.wav/.mid, audio_mix.wav), `data/` (sprite stroke JSON + previews),
`build/` (mv.js, mv.hash), `chunks/` (resumable render cache), `out/` (videos, stills, check/).

## timeline.json (edit by hand when needed)
```json
{"song_duration": 183.2, "video_offset_s": 1.5, "locked": false,
 "lines": [{"i": 1, "section": "Verse 1", "text": "…", "song_start": 0.62, "song_end": 4.45, "confidence": "high", "split_song": 2.4, "skip": false}]}
```
Only `text`, `song_start`, `song_end`, `skip`, `split_song` are read by the engine. Set `"locked": true` after manual fixes so
`bpmv.py timeline` never overwrites it (use `--force` to rebuild anyway).
