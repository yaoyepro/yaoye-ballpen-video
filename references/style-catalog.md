# 风格目录（style catalog）

所有风格共用同一套锁定的视觉规范（[STYLE.md](STYLE.md)）：奶油色横线纸 + 红色边线、蓝色圆珠笔手写与线稿、四层排线、红/绿点缀笔、看得见的笔、翻页/大橡皮/小橡皮。区别只在**内容结构**。告诉助手编号即可，例如“用 A”。

| 编号 | 名称 | 预览 | 输入 | 主画 | 背景 | 默认配乐 | 典型时长 |
|---|---|---|---|---|---|---|---|
| **A** | 文字 + 涂鸦 | `assets/demos/A.gif` | 主题 / 关键词 / 文案 / 长文 | 涂鸦库（50 个） | ground，1–2 页 wash | none + 笔声，或 auto | 30–45 s |
| **B** | 诗词夜色 | `assets/demos/B.gif` | 诗 / 抒情短句 | 涂鸦（月、星、山、房子…） | night + ground | none + 笔声，或 external | 30–40 s |
| **C** | 角色叙事 | `assets/demos/C.gif` | 任意文字 + 角色图片 | 角色图片（描成圆珠笔线条） | wash / night + ground | auto | 20–45 s |
| **D** | 歌词 MV | `assets/demos/D.gif` | 歌（音频 + 歌词）+ 建议 4–20 张你自己的角色图（也可只用涂鸦） | 角色图片或涂鸦 | 手写 scenes.js | 歌本身 | = 歌长 |

## A · 文字 + 涂鸦
- script.json：`input_mode` = theme/keywords/copy/article；每页 1 个涂鸦主画 + 0–3 个小涂鸦。
- 推荐：版式轮换 text-left / text-right / text-top；第 2 或第 3 页用 `["wash","ground"]`。
- 范例：[script-examples.md](script-examples.md) 的 theme / keywords / copy / article。

## B · 诗词夜色
- `--input poem` 自动生成 script.json：一句一页、单数句新页、双数句用小橡皮续写、月/星页自动夜空排线。
- 你需要检查：重复的主画（例如两次月亮）可换成 `house`、`mountain`、`window` 等；`subtitle` 写作者。
- 范例：script-examples.md 的 poem。

## C · 角色叙事
- 本包**不附带任何角色图片**。先按 SKILL.md 第 5 节准备图片（用户图片 → 生图工具 → 不用角色）。预览 C.gif 里的方框只是“角色图放这里”的占位。
- 每页 `"main": {"sprite": "名字"}`；同一角色不同动作；角色站在地面线上，高度 380–520 px。
- 范例：script-examples.md 的 character（2 张角色图、2 页、约 24 秒、auto 配乐，已实测）。

## D · 歌词 MV
- SKILL.md 第 6 节：ASR 对齐歌词时间 → 人工核对 → 手写 scenes.js（API：[SCENE_API.md](SCENE_API.md)）。
- 测试样例：`examples/demo`（17 秒程序生成的无版权示例曲 + 占位歌词 + 手写时间轴，只用涂鸦，不含角色图，装好就能跑）。

## 模板特点
| 特点 | 说明 |
|---|---|
| 一支笔画完全片 | 所有线条、文字都由可见的圆珠笔实时画出；同一时间只有一个笔划任务 |
| 风格锁定 | 线宽、排线角度与间距、字号、纸张、颜色全部是固定数值（STYLE.md） |
| 任意文字输入 | 主题/关键词/文案/诗/长文自动按阅读速度计时，不需要音频 |
| 不画假人 | 人物只来自真实图片；涂鸦库只有物体与自然 |
| 声音可选 | 笔声、自动作曲、外部音乐（-16 LUFS）、歌曲同步 |
| 可继续修改 | 改 script.json 或 scenes.js 后重新出片；渲染分块可断点续跑 |
