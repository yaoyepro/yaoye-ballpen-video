# 更新记录

## 1.0.1 — 2026-10
- 开源前清理：示例里不再包含任何角色图片、真实歌曲片段或真实歌词。`examples/demo` 改用程序生成的无版权示例曲（`make_demo_audio.py`，CC0）+ 占位歌词 + 手写时间轴（`"timeline_seed"`），场景只用涂鸦。
- 新增 project.json 可选字段 `"timeline_seed"`：首次使用时把手写时间轴复制到 `work/timeline.json`（适合没有人声的歌）。
- 角色范例改用 `my_happy` / `my_sleepy` 名称，缺图时报错会提示“本包不含角色图，请放入你自己的图片”。
- 封面和预览 GIF 全部用清理后的示例重新生成。

## 1.0.0 — 2026-10
- 新名称 **yaoye-ballpen-video（瑶叶·圆珠笔版）**（前身：ballpen-lyric-mv）。
- 任意输入：主题 / 关键词 / 文案（逐字保留）/ 诗（逐字保留）/ 长文（压缩）/ 歌（歌词同步）。`bpmv.py script` 校验并按阅读速度自动计时，可设目标时长。
- 风格锁定为 `presets/ballpoint.json`（STYLE.md 记录全部数值）；新增满页浅排线背景 `wash`、夜空 `night`、光晕 `sky`、地面线 `ground`。
- 片子结构积木：片头 → N 页（文字槽 + 主画 + 小涂鸦 + 背景）→ 翻页 / 大橡皮 / 小橡皮 → 片尾；6 种版式；50 个涂鸦。
- 配乐：none（+笔声）、auto（离线自动作曲，可选 fluidsynth / Lyria）、external（music_brief + mux）、song；-16 LUFS / ≤ -1.5 dBTP。
- 新命令：`setup`、`script`、`music`、`foley`、`mux`；`doctor` 把歌曲模式组件标为可选。
- 字体回退（缺失字体 → 随包 Yozai）与缺字检查。
- 中文 README、风格目录 A–D 与预览 GIF、详细分步手册（Windows/mac/Linux 命令、停止点、检查表、常见问题）。
