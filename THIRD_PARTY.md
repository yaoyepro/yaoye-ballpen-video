# Third-party components, fonts and media

The toolkit code and documentation in this package are licensed under the [MIT License](LICENSE) (© 2026 瑶叶 · 一叶知 AI).
Third-party components keep their own licenses; the MIT license does not replace them.

## Bundled
| item | license | notes |
|---|---|---|
| `fonts/Yozai-Regular.ttf` — Yozai (悠哉字体) v0.868, unmodified | SIL Open Font License 1.1 | full text: `licenses/OFL-Yozai.txt` (also `fonts/OFL-Yozai.txt`). May be bundled and redistributed with software; may not be sold by itself. Source: github.com/lxgw/yozai-font |
| `assets/cover.*`, `assets/demos/*.gif` | part of this package (MIT) | rendered from this package's own examples (text + doodles only, no photos or character images). C.gif shows a placeholder frame where your own character image goes |
| `examples/demo/audio/demo_song.mp3` | CC0 / public domain | 17 s instrumental generated from code by `examples/demo/make_demo_audio.py` (numpy formulas, nothing sampled) |
| `examples/demo/*` (placeholder lyrics, hand-written timeline, DEMO logo, doodle-only scenes) | part of this package (MIT) | test fixtures; no character images are bundled |

## Installed separately (not bundled)
| item | license | used for |
|---|---|---|
| skia-canvas (npm) | MIT | 2D rendering |
| numpy, scipy, Pillow, opencv-python-headless, scikit-image, soundfile, librosa, fonttools | BSD / MIT / HPND / Apache-2.0 / ISC (see each package) | image tracing, audio, glyph check |
| faster-whisper, demucs, torch (song mode only) | MIT / MIT / BSD-3 | lyric timing |
| ffmpeg | LGPL/GPL (depending on build) | encoding, loudness |
| fluidsynth + any soundfont (optional) | LGPL-2.1 / soundfont's own license | alternative AUTO-music rendering |
| google-genai / Google Lyria (optional) | Apache-2.0 SDK; API under Google's terms | alternative AUTO music; needs the user's own `GEMINI_API_KEY` |

Optional font download (`scripts/fetch_fonts.py --longcang`): LongCang, SIL OFL 1.1.
Users must hold the rights to any audio, images and fonts they add to their own projects.
