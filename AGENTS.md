# AGENTS.md — yaoye-ballpen-video（瑶叶·圆珠笔版）通用助手入口

适用：Codex、Claude Code、WorkBuddy、Grok Bot，以及任何能读文件并运行命令的助手。
**没有 Skill 加载机制时：先完整读 `SKILL.md`，再读本文件，然后严格按 SKILL.md 的编号步骤执行。**

## 你要完成的任务
把用户的 主题 / 关键词 / 文案 / 诗 / 长文 / 歌，做成“蓝色圆珠笔在横线笔记本上边写边画”的短视频：
`<项目>/out/<name>_1080p60.mp4` + `<name>_phone_720p30.mp4`。

## 命令（在本文件夹运行；Windows 用 `python` 或 `py -3`，macOS/Linux 用 `python3`）
| 步骤 | Windows | macOS / Linux | 成功标志 |
|---|---|---|---|
| 安装（一次） | `python bpmv.py setup` | `python3 bpmv.py setup` | 最后一行 `ALL GOOD` |
| 建项目 | `python bpmv.py init D:\ballpen\x` | `python3 bpmv.py init ~/ballpen/x` | `new SCRIPT project in` |
| 输入 | `python bpmv.py script -p D:\ballpen\x\project.json --input theme --text "主题"` | 同左，`python3`、`~/ballpen/x` | 生成 `work/script_brief.md` |
| 写 script.json | 按 `references/script-examples.md` 同类型范例写 | 同左 | 无 `TODO` |
| 校验+计时 | `python bpmv.py script -p ...` | `python3 bpmv.py script -p ...` | 打印 `plan: ...`，无 `ERROR` |
| 组装 | `python bpmv.py build -p ...` | `python3 bpmv.py build -p ...` | `warnings:` 下面是 `none` |
| 静帧 | `python bpmv.py stills -p ... -t 3,8,14` | 同左 | `out/stills/*.png`，**必须打开看** |
| 样片 ⛔ | `python bpmv.py sample -p ... --seconds 20 --fps 30` | 同左 | 发给用户，**等用户确认** |
| 正式 | `python bpmv.py render -p ...` | 同左 | `out/*_1080p60.mp4` |
| 自检 | `python bpmv.py check -p ... --video <mp4>` | 同左 | `SELF-CHECK: PASS` |
| 加音乐（可选） | `python bpmv.py mux -p ... --music bgm.mp3` | 同左 | 打印 `loudness: -16 ...` |

歌曲模式：`init <dir> --mode song` → `timeline`（⛔ 核对 `work/timeline_review.md`）→ `prep` → 手写 `scenes.js` → build/stills/sample⛔/render/check。

## 规则（违反任何一条都算失败）
- 只修改用户项目文件夹里的 `script.json`、`project.json`、`scenes.js`、`work/timeline.json`；不改 `engine/`、`scripts/`、`presets/`（除非在修真实 bug，并告诉用户）。
- 用户确认样片之前不运行 `render`。
- 不改诗、用户文案（copy 模式）、歌词的任何字；文章模式不编造事实/数字。
- 不用代码画人物/动物，不翻转角色图；没有图片就只用涂鸦。
- 每行 ≤ 12 个汉字、每页 1–2 行、每页 1 个主画 + 0–3 个小涂鸦。
- 交付时给出绝对路径、MB、秒数、LUFS；没看过帧图不准说完成。
- 报错先查 `references/troubleshooting.md`；不要手改 `build/mv.js` 绕过。

`examples/` 只是测试样例，不能当作用户作品素材。
