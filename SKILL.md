---
name: yaoye-ballpen-video
description: 瑶叶·圆珠笔版——把主题、关键词、文案、诗、长文或一首歌，做成“一支蓝色圆珠笔在奶油色横线笔记本上边写边画”的手绘短视频（1080p MP4 + 手机版）。手写文字、线稿+排线、红绿点缀笔、翻页/大橡皮/小橡皮转场；配乐可选：无音乐+笔声、自动作曲、外部音乐、歌词同步。支持 Windows/macOS/Linux，Codex、Claude Code、WorkBuddy、Grok Bot 等能读文件并运行命令的助手。
metadata:
  version: "1.0.1"
  author: "瑶叶 · 一叶知 AI 出品"
  siblings: "yaoye-handdrawn-video (手绘版), yaoye-motion-video (强动效版)"
---

# 瑶叶·圆珠笔版（yaoye-ballpen-video）执行手册

本文件是 AI 助手的**主入口**。请从头到尾按编号执行，不要跳步。更深的细节在 `references/`：

| 需要什么 | 读哪个文件 |
|---|---|
| 第一次和用户对话、引导用户提供素材 | [references/start-creating.md](references/start-creating.md) |
| 安装、Windows/mac/Linux 差异、字体 | [references/compatibility.md](references/compatibility.md) |
| 风格编号 A/B/C/D 怎么选 | [references/style-catalog.md](references/style-catalog.md) |
| script.json 每个字段 | [references/SCRIPT_SCHEMA.md](references/SCRIPT_SCHEMA.md) |
| 每种输入类型的完整 script.json 范例（可直接复制） | [references/script-examples.md](references/script-examples.md) |
| 画面结构、版式、涂鸦库（50 个） | [references/STRUCTURE.md](references/STRUCTURE.md) |
| 视觉风格的全部数值（锁定） | [references/STYLE.md](references/STYLE.md) |
| 音乐/音效四种模式 | [references/music.md](references/music.md) |
| 报错怎么办 | [references/troubleshooting.md](references/troubleshooting.md) |
| 歌曲模式手写 scenes.js 的 API | [references/SCENE_API.md](references/SCENE_API.md) |
| project.json 全部配置 | [references/CONFIG.md](references/CONFIG.md) |

---

## 0. 命令写法（每一步都要用对）

所有命令都在**本 Skill 文件夹**里运行（含 `bpmv.py` 的那个文件夹），并且总是带 `-p <项目文件夹>/project.json`。

| 系统 | Python 命令 | 例子 |
|---|---|---|
| Windows（PowerShell / CMD） | `python`（不行就用 `py -3`） | `python bpmv.py doctor` |
| macOS / Linux | `python3` | `python3 bpmv.py doctor` |

- 路径有空格时必须加英文双引号：`-p "D:\我的 视频\sun\project.json"`。
- 项目文件夹放在 Skill 文件夹**外面**（例如 Windows `D:\ballpen\sun`，mac `~/ballpen/sun`）。
- 下面每一步都同时给出 Windows 和 macOS/Linux 写法；`<SKILL>` = 本文件夹，`<PRJ>` = 项目文件夹。

---

## 1. 用户说“加载 yaoye-ballpen-video，引导我开始创作”时

1. 读 [references/start-creating.md](references/start-creating.md)，把其中“第一条引导”发给用户（已经知道的就不要再问）。
2. 一次只问还缺的 1–2 项，顺序固定：**① 内容（主题/关键词/文案/诗/长文/歌）→ ② 时长（默认 30–45 秒）→ ③ 配乐（默认：无音乐+笔声）→ ④ 有没有角色图片（默认：没有，只用涂鸦）→ ⑤ 输出文件夹**。
3. 用户已经给了内容，就直接进入第 2 步，不要再发欢迎语。

---

## 2. 判断输入类型和风格（决策表）

### 2.1 输入类型 → 模式

| 用户给的东西 | 判断标准 | `--input` | 屏幕上的字由谁写 | 页数 | 每页行数 |
|---|---|---|---|---|---|
| 主题（一句话，如“和太阳奔跑”） | ≤ 20 字、没有完整句子 | `theme` | **你写原创文案** | 5–9 页 | 1–2 行 |
| 关键词（如“雨天, 书店, 热可可”） | 2–8 个用逗号/顿号隔开的词 | `keywords` | 你写，每个关键词必须出现或被画出来 | 4–8 页 | 1–2 行 |
| 文案（用户自己写好的一段话，≤ 200 字） | 用户说“用我的文案/原话” | `copy` | **一字不改**，你只负责断行分页 | 按长度，约每 20 字 1 页 | 1–3 行 |
| 诗 / 歌词式短句（有固定行） | 有明显分行，≤ 16 行 | `poem` | 一字不改（包括标点），自动生成 | 1 行 1 页（> 8 行时 2 行 1 页） | 1–2 行 |
| 长文 / 文章（> 200 字） | 段落、事实、数字 | `article` | 你压缩成要点，**事实/数字/名称不改不编** | 6–12 页 | 1–3 行 |
| 歌（音频文件 + 歌词） | 有 mp3/wav/m4a/flac | 歌曲模式（`init --mode song`） | 歌词按演唱时间出现 | 每句或每两句 1 页 | 1–4 行 |

### 2.2 风格编号（详细见 [style-catalog.md](references/style-catalog.md)）

| 编号 | 名称 | 什么时候用 | 需要的素材 |
|---|---|---|---|
| **A** | 文字 + 涂鸦 | 主题/关键词/文案/长文，没有角色图片 | 只要文字 |
| **B** | 诗词夜色 | 诗、安静抒情的短句 | 只要文字 |
| **C** | 角色叙事 | 想要固定的人物/动物角色出镜 | 文字 + 2–10 张角色图片（用户提供或你用生图工具生成） |
| **D** | 歌词 MV | 有一首歌 | 音频 + 歌词 + 4–20 张角色图片 |

### 2.3 配乐模式（详细见 [music.md](references/music.md)）

| 用户的情况 | `music.mode` | `foley.enabled` | 结果 |
|---|---|---|---|
| 没说 / 不要音乐 | `none` | `true` | 只有圆珠笔沙沙声、翻页声、橡皮声（约 -20 LUFS） |
| “帮我配个音乐” 且没有音乐文件 | `auto` | `true` | 自动作曲（离线），-16 LUFS |
| 用户有音乐文件 / 之后要找人做音乐 | `external` | `true` | 先导出 `work/music_brief.md`，渲染后用 `mux --music 文件` 合成，-16 LUFS |
| 歌曲模式 | `song` | `false` | 歌本身就是音轨 |

---

## 3. 第一次使用：安装与检查（每台电脑只做一次）

**前提：** 已安装 Node.js ≥ 18、Python ≥ 3.10、ffmpeg（Windows：`winget install Gyan.FFmpeg`，装完重开终端；mac：`brew install ffmpeg node python`；Ubuntu：`sudo apt install ffmpeg nodejs npm python3-pip`）。

```
# Windows
cd <SKILL>
python bpmv.py setup            # 歌曲模式再加 --audio
# macOS / Linux
cd <SKILL>
python3 bpmv.py setup           # 歌曲模式再加 --audio
```
- **预期输出：** 最后一行 `ALL GOOD`。`[--]` 开头的行是可选项（例如只在歌曲模式需要的 faster_whisper），不算失败。
- **失败时：** 看哪一行是 `[!!]`，按该行箭头后的提示修；常见问题见 [troubleshooting.md](references/troubleshooting.md) 第 1 节。修完运行 `python bpmv.py doctor`（mac/Linux：`python3 bpmv.py doctor`）直到 `ALL GOOD`。
- 时间：首次 2–10 分钟（下载 skia-canvas 约 30 MB；`--audio` 还要下载约 2 GB 的 torch/whisper）。

---

## 4. 文字类输入（A/B/C 风格）：完整步骤

### 步骤 4.1 建项目
```
# Windows
python bpmv.py init D:\ballpen\sun
# macOS / Linux
python3 bpmv.py init ~/ballpen/sun
```
- **预期：** 打印 `new SCRIPT project in ...`；项目里有 `project.json`、`scenes.js`、`sprites/`、`audio/`、`logo/`。
- **失败：** `project.json already exists` → 换一个新文件夹名。

### 步骤 4.2 写入输入，生成 brief
```
# Windows
python bpmv.py script -p D:\ballpen\sun\project.json --input theme --text "和太阳奔跑" --title "和太阳奔跑"
# macOS / Linux
python3 bpmv.py script -p ~/ballpen/sun/project.json --input theme --text "和太阳奔跑" --title "和太阳奔跑"
```
- `--input` 取 `theme | keywords | copy | poem | article`（见 2.1）。长文本用 `--file 文本.txt`（UTF-8）代替 `--text`。诗可加 `--author 作者`。
- **预期：** 生成 `<PRJ>/work/script_brief.md`（规则 + 涂鸦清单 + 原文）和 `<PRJ>/script.json`。
  - `poem`：script.json 已自动写好（诗句原样），你只需检查第 4.3 步的要求。
  - 其他：script.json 是带 `TODO` 的骨架，**你必须在 4.3 步把它写完整**。

### 步骤 4.3 编写 script.json（最关键的一步）
1. 打开 `work/script_brief.md`，看“Doodle catalogue”里有哪些涂鸦名（只能用清单里的名字）。
2. 打开 [script-examples.md](references/script-examples.md)，复制**同一输入类型**的范例，替换成本次内容。
3. 必须遵守的数字：
   - 每行 **≤ 12 个汉字**（英文 ≤ 24 个字母）；超过 16 会报错，13–16 会自动缩小字号。
   - 每页 **1–2 行**（最多 4 行）；`title` ≤ 10 个汉字。
   - 每页**一个** `main`（主画），`extras` **0–3 个**小涂鸦。
   - 第 1 页 `transition` 用 `flip`；之后 `flip` 和 `erase` 交替；同一幅画换字用 `small_erase`（此页不写 `main`）。
   - `layout` 轮换：`text-left` → `text-right` → `text-top` → …，相邻两页不要用同一个。
   - `background`：一般用 `"ground"`；全片挑 1–2 页用 `["wash","ground"]`（满页浅排线，最像原作）；月亮/星星页用 `["night","ground"]`。
   - `target_duration`：30–60（秒）。每页约 4–7 秒，所以 **页数 ≈ 目标秒数 ÷ 6**。
   - `pace`：诗/安静 `calm`；一般 `normal`；欢快 `lively`。
   - `mood`：3–8 个英文或中文形容词（给自动配乐用），如 `"bright, hopeful, morning"`。
4. 主画来源优先级：**用户图片 → 你用生图工具生成的图片 → 涂鸦库**。没有图片也完全可以只用涂鸦（风格 A/B）。用图片时见第 5 节。
5. 文案写作要求（theme/keywords/article）：具体画面，不喊口号；起（第 1 页画面）→ 承（2–4 页展开）→ 转（1 页变化）→ 合（温暖收尾）；每页文字要能被那页的主画**直接画出来**。

6. **⛔ 停止点 A（方案确认）：** 把方案用表格发给用户（列：页号 / 每行文字 / 主画 / 小涂鸦 / 转场），问“文案和画面这样可以吗？”。用户确认后再继续；`poem`/`copy` 模式文字不能改，只确认画面。

### 步骤 4.4 检查 + 计划时间
```
# Windows
python bpmv.py script -p D:\ballpen\sun\project.json
# macOS / Linux
python3 bpmv.py script -p ~/ballpen/sun/project.json
```
- **预期：** 打印 `plan: N script pages -> ... X s` 和每页时间表；生成 `work/plan.json`、`work/timeline.json`、`work/music_brief.md`。
- **失败：** `ERROR: script.json invalid:` 后面逐条列出问题，按提示改 script.json 再运行。常见：
  - `line too long` → 把这行拆成两行或两页；
  - `unknown doodle 'xxx'` → 换成 brief 清单里的名字；
  - `poem lines missing or changed` / `copy mode: ... first difference` → 你改了原文，改回原样；
  - `WARN target_duration ... not reachable` → 加页（太短）或减页（太长），差 10% 以内可以接受；
  - `WARN font ... has no glyph for: X` → 这些字字体里没有，换写法或换字体（compatibility.md 字体一节）。

### 步骤 4.5 设置配乐（按 2.3 表）
打开 `<PRJ>/project.json`，改 `"music"` 和 `"foley"`，例如自动作曲：
```json
"music": {"mode": "auto"},
"foley": {"enabled": true, "level_db": -24}
```
同时把 `"title"` 改成片名、`"output_name"` 改成英文文件名（如 `"run_with_sun"`，只用字母数字下划线）。

### 步骤 4.6 组装 + 看静帧
```
# Windows
python bpmv.py build  -p D:\ballpen\sun\project.json
python bpmv.py stills -p D:\ballpen\sun\project.json -t 3,8,14,20
# macOS / Linux
python3 bpmv.py build  -p ~/ballpen/sun/project.json
python3 bpmv.py stills -p ~/ballpen/sun/project.json -t 3,8,14,20
```
- `-t` 的时间点：从 `script` 打印的时间表里，取每页结束前 1 秒（画完整的样子）。
- **预期：** build 最后是 `warnings:` 下一行 `none`；`<PRJ>/out/stills/t_*.png` 生成。
- **必须做：** 打开（Read）每张 PNG 自己看：文字是否完整可读、主画是否在纸上且不被裁、排线没有盖住文字、页面至少 35% 留白。有问题回到 4.3 改，再重复 4.4–4.6。
- **失败：** `no free space for extra "x"` → 删掉一个 extras 或换小的；`scene build failed` → 看 troubleshooting.md 第 3 节。

### 步骤 4.7 样片 —— ⛔ 停止点 B（样片确认）
```
# Windows
python bpmv.py sample -p D:\ballpen\sun\project.json --seconds 20 --fps 30
# macOS / Linux
python3 bpmv.py sample -p ~/ballpen/sun/project.json --seconds 20 --fps 30
```
- **预期：** `<PRJ>/out/<output_name>_sample_1080p30.mp4`、`..._phone_720p30.mp4`、`out/sample_frames/` 下 3 张 PNG。约 1–3 分钟。
- 自己先 Read 3 张帧图，再把**手机版 mp4 + 3 张帧图 + 全部文案（每页一行）**发给用户，问：“文案、画面、笔速、配乐可以吗？要改哪里？”
- **⛔ 在用户明确回复“可以/通过/OK”之前，不准运行 render。** 用户要改：改 script.json/project.json → 重做 4.4、4.6、4.7。

### 步骤 4.8 正式渲染
```
# Windows
python bpmv.py render -p D:\ballpen\sun\project.json
# macOS / Linux
python3 bpmv.py render -p ~/ballpen/sun/project.json
```
- 默认 60 fps；电脑慢或只是预览用 `--fps 30`。速度参考：8 核约 3 秒算 1 秒视频（60 fps）。中断后重新运行同一命令会从断点继续。
- **预期：** `<PRJ>/out/<output_name>_1080p60.mp4` 和 `<output_name>_phone_720p30.mp4`。
- **失败：** `refuses to start while build warnings exist` → 回 4.6 修到 `none`。

### 步骤 4.9 自检
```
# Windows
python bpmv.py check -p D:\ballpen\sun\project.json --video D:\ballpen\sun\out\run_with_sun_1080p60.mp4
ffmpeg -i D:\ballpen\sun\out\run_with_sun_1080p60.mp4 -af ebur128=peak=true -f null -
# macOS / Linux
python3 bpmv.py check -p ~/ballpen/sun/project.json --video ~/ballpen/sun/out/run_with_sun_1080p60.mp4
ffmpeg -i ~/ballpen/sun/out/run_with_sun_1080p60.mp4 -af ebur128=peak=true -f null -
```
- **通过标准：** `SELF-CHECK: PASS`；ebur128 结尾 `I:` 在 -17 ~ -15 LUFS（有音乐时）、`Peak:` ≤ -1.5 dBFS；视频与音频时长相差 ≤ 0.1 秒（`ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 文件.mp4`）。
- Read `out/check/overview_*.png`（每秒一格的总览），确认没有空白页、没有黑帧。
- **⛔ 停止点 C（交付）：** 把手机版、主文件路径、大小、时长、响度结果交给用户。

### 步骤 4.10（可选）之后再加外部音乐
```
# Windows
python bpmv.py mux -p D:\ballpen\sun\project.json --music D:\music\bgm.mp3 [--offset 3.5]
# macOS / Linux
python3 bpmv.py mux -p ~/ballpen/sun/project.json --music ~/music/bgm.mp3 [--offset 3.5]
```
不重新渲染画面，30 秒左右完成；会打印 `loudness: -16.0 LUFS ...`。`--offset` = 从音乐第几秒开始用。

---

## 5. 用图片做主画（风格 C；也用于 D）

1. 图片要求：每张一个角色/物体，**白色或透明背景**、清楚的深色描边、平涂颜色、高度 ≥ 500 px、PNG/JPG；同一角色的不同动作（笑、跑、睡…）。
2. 没有图片且你有生图工具时，用这个提示词模板（每个动作一张，角色描述每次完全相同）：
   ```
   <角色描述：发型、衣服、颜色>，<动作/姿势>，flat 2D illustration, clean dark outlines, simple flat colours, full figure, centred, plain pure white background, no text, no shadow, no border
   ```
   出现多手指、断手断脚、文字、衣服前后不一致的图 → **重新生成**，不要修补。没有生图工具 → 只用涂鸦，不要用代码画人。
3. 白底图转透明：
   ```
   # Windows
   python bpmv.py cutout --src raw --dst sprites -p D:\ballpen\c\project.json
   # macOS / Linux
   python3 bpmv.py cutout --src raw --dst sprites -p ~/ballpen/c/project.json
   ```
   （`raw`、`sprites` 是项目文件夹里的子文件夹。）
4. 在 project.json 登记：`"sprites": {"my_happy": {"height": 440}, "my_sleepy": {"height": 470}}`（高度 = 画面上的像素高，1080 画面里一般 380–520，躺/抱等横向姿势 450–520）。
5. 转换成圆珠笔线条：`python bpmv.py prep -p ...`（mac/Linux `python3`）。**预期：** 每张图打印 `lines N ... hatch [...]`，并生成 `data/<名字>_preview.png`。Read 每张 preview：粗线=描边、细线=排线、红/绿=点缀。线太少 → project.json 加 `"prep": {"dark_v": 110}` 再 prep。
6. 在 script.json 里写 `"main": {"sprite": "my_happy"}`。然后从 4.4 继续。

---

## 6. 歌曲模式（风格 D）

```
# Windows
python bpmv.py init D:\ballpen\song --mode song
# macOS / Linux
python3 bpmv.py init ~/ballpen/song --mode song
```
1. 把歌放进 `audio/`，在 `lyrics.txt` 里**按实际演唱**一行一句（重复段落也要写出来），角色图按第 5 节放进 `sprites/` 并 prep。project.json 填 `"audio": "audio/歌名.mp3"`、`"title"`、`"credits"`。
2. `python bpmv.py timeline -p ...`（需要 `setup --audio`）。**预期：** `work/timeline.json` 和 `work/timeline_review.md`。CPU 上约为歌曲时长的 1–2 倍。
3. **⛔ 停止点 T（歌词时间核对）：** 打开 `timeline_review.md`，凡不是 `high` 的行都要核对时间；改 `work/timeline.json` 的 `song_start/song_end/text`，改完加 `"locked": true`。拿不准就把有疑问的行和时间发给用户确认。
4. 按 [SCENE_API.md](references/SCENE_API.md) 手写 `scenes.js`（先列分镜表：每页时间、歌词行、画面、角色、结束方式）。歌词只能用 `lyric(P, i, slot)` 引用，**绝不手打歌词**。
5. 然后同 4.6 → 4.9（build / stills / sample⛔ / render / check）。歌曲模式保持歌曲原响度，不做 -16 LUFS 处理。

---

## 7. 绝对不要做（Never do）

1. **不要用代码画人物或动物**（看起来廉价，已被否决）。人物只能来自真实图片；涂鸦库只有物体/自然/符号。
2. 不要水平翻转角色图片（细节会错）；需要另一个方向就重新生成。
3. 不要改诗句、用户文案（`copy`）、歌词的任何一个字或标点；文章模式不要编造事实或数字。
4. 不要在用户确认样片之前运行 `render`。
5. 不要修改 `engine/`、`scripts/`、`presets/` 来“调风格”；要改只改项目文件夹里的 `script.json`、`project.json`、`scenes.js`。
6. 不要使用涂鸦清单以外的名字；不要每页塞 4 个以上的 extras。
7. 不要让文字进入左边红色边线（x < 140 像素）；不要让任何东西盖住文字。
8. 不要使用来路不明的字体、音乐或图片；不要把 `examples/demo` 里的素材用于正式作品。
9. 不要在 build 有 warnings 时交付；不要不看帧图就说“完成了”。
10. 不要把一次失败的命令换成另一种方式偷偷绕过（比如手改 build/mv.js）；看 troubleshooting.md。

## 8. 交付前最终检查表（逐项打勾后再交付）

- [ ] 用户已确认方案（停止点 A）和样片（停止点 B）。
- [ ] `build` 输出 `warnings: none`；`check` 输出 `SELF-CHECK: PASS`。
- [ ] 每页文字与 script.json 一致、可读，每行 ≤ 12 字，没有被线条盖住。
- [ ] 每页主画与文字内容对应；画面至少 35% 留白；没有东西被画面边缘切掉。
- [ ] 一支笔：所有线条都是笔画出来的；翻页/橡皮时看不到笔。
- [ ] 动作平稳：无闪烁、无抖动、无黑帧（看 overview 总览图）。
- [ ] 有音乐：-17 ~ -15 LUFS，峰值 ≤ -1.5 dBTP；音视频时长差 ≤ 0.1 秒。
- [ ] 交付：主文件（1080p）和手机版（720p30）的**绝对路径**、文件大小（MB）、时长（秒）、响度数值。

## 9. 坑（经验）

- 写得太长的行会被缩小、显得挤 → 拆行。页面太满比太空难看。
- `target_duration` 只能在自然时长的 0.6–1.8 倍之间缩放；差太多就加/减页。
- 任何修改都会让已渲染的分块失效（自动处理）→ 先用 `stills`/`sample` 调，最后只 `render` 一次。
- `small_erase` 页上新加的 extras 会画在背景排线上面（`wash`/`night` 页时可见），想要干净就把它放到下一张新页。
- Windows 中文乱码：先运行 `set PYTHONUTF8=1`（PowerShell：`$env:PYTHONUTF8=1`）。

## 10. 版本

1.0.1（2026-10）—— 见 [CHANGELOG.md](CHANGELOG.md)。瑶叶 · 一叶知 AI 出品。MIT License（[LICENSE](LICENSE)），第三方说明 [THIRD_PARTY.md](THIRD_PARTY.md)。
