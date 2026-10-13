# 音乐与音效（music）

在 `<项目>/project.json` 里设置：
```json
"music": {"mode": "none", "file": null, "offset": 0.0, "fade_in": 0.5, "fade_out": 2.0, "lufs": -16, "engine": "synth", "soundfont": null},
"foley": {"enabled": true, "level_db": -24}
```

## 1. 四种模式怎么选
| 模式 | 什么时候 | 要做的事 | 结果响度 |
|---|---|---|---|
| `none` | 默认；用户没要求音乐 | 无（`foley.enabled: true` 时有笔声） | 只有笔声：约 -20 LUFS；全静音：静音轨 |
| `auto` | 用户要音乐但没有文件 | 无，render/sample 时自动作曲；想先听：`python bpmv.py music -p ...` | -16 LUFS，峰值 ≤ -1.5 dBTP |
| `external` | 用户有音乐，或要交给作曲者 | 把 `work/music_brief.md` 给作曲者；拿到文件后 `python bpmv.py mux -p ... --music 文件 [--offset 秒]`，或填 `"file"` 后 render | -16 LUFS，峰值 ≤ -1.5 dBTP |
| `song` | 歌曲模式 | 自动（歌即音轨） | 保持歌曲原响度 |
（macOS/Linux 把 `python` 换成 `python3`。）

## 2. auto 自动作曲是怎么做的
- 全部离线：Python 生成和弦进行、钢琴琶音、柔和铺底、低音、铃声旋律；`lively` 时加轻打击；每次翻页/橡皮处加一个钟声/上扬。
- 速度：`pace` calm = 76 BPM，normal = 96 BPM，lively = 116 BPM。
- 调性：全片和每页 `mood` 里出现 **2 个及以上** 这些词（sad, nostalg, quiet, night, lonely, miss, melanch, moon, 思, 静, 夜, 孤, 愁, 念, 月）→ 小调感进行；否则大调（lively 用更明亮的进行）。主音 C/D/F/G 由片名+mood 决定（同样的输入每次结果相同）。
- 输出：`work/music_auto.wav`（音频）+ `work/music_auto.mid`（MIDI，可在任何音乐软件里换音色）。
- 可选引擎（`"engine"`）：
  - `"synth"`（默认）内置合成器，无需任何额外软件；
  - `"fluidsynth"`：需要 `fluidsynth` 程序 + `"soundfont": "路径.sf2"`（General MIDI 音色库），音色更真；缺任意一项自动退回 synth；
  - `"lyria"`：Google Lyria，需要环境变量 `GEMINI_API_KEY` 和网络 + `pip install google-genai`；任何失败都退回 synth。（本包测试时未提供密钥，此路径未实测。）

## 3. 笔声（foley）
- 根据渲染时笔的真实落笔与速度生成沙沙声；翻页 = 呼一声 + 轻拍；橡皮 = 摩擦声。
- `level_db`：-24（默认）。有音乐时笔声自动比音乐低约 14 dB。不想要笔声：`"enabled": false`。

## 4. 响度标准与检查
- 有音乐：两遍 loudnorm 到 **-16 LUFS**，真峰值 **≤ -1.5 dBTP**；开头 0.5 秒淡入、结尾 2 秒淡出。
- 检查命令：
  ```
  ffmpeg -i 视频.mp4 -af ebur128=peak=true -f null -
  ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 视频.mp4
  ```
  看输出最后 `I:`（应为 -17 ~ -15 LUFS）、`Peak:`（≤ -1.5）；video 与 audio 时长差 ≤ 0.1 秒。

## 5. music_brief.md（external 模式交给作曲者）
包含：总时长（秒，精确到 0.01）、整体情绪、建议 BPM、每段（片头/每页/片尾）的开始结束时间与屏幕文字、转场时间点（适合做重音）、以及合成命令。音乐比视频长没关系，会被裁剪并淡出。
