# 平台、助手与字体兼容（compatibility）

## 支持范围
- 系统：Windows 10/11（原生 PowerShell/CMD）、macOS 12+、Linux（x64/arm64）。
- 助手：Codex、Claude Code、WorkBuddy、Grok Bot，以及任何**能读写文件并运行命令**的助手。只能聊天、不能运行命令的助手只能帮你写 script.json，不能出片。
- 有 Skill 加载机制：加载本文件夹（`SKILL.md` 是入口）。没有：让助手先读 `SKILL.md` 和 `AGENTS.md`。

## 需要预先安装的系统工具（setup 不会替你装这些）
| 工具 | 版本 | Windows | macOS | Ubuntu/Debian |
|---|---|---|---|---|
| Node.js | ≥ 18 | `winget install OpenJS.NodeJS.LTS` | `brew install node` | `sudo apt install nodejs npm` |
| Python | ≥ 3.10 | `winget install Python.Python.3.12` | `brew install python` | `sudo apt install python3 python3-pip` |
| ffmpeg | ≥ 5 | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `sudo apt install ffmpeg` |
装完**关闭并重开终端**，再运行 `python --version`、`node -v`、`ffmpeg -version` 确认能找到。

## 命令入口
| 平台 | 安装依赖 | 检查环境 |
|---|---|---|
| Windows | `python bpmv.py setup`（或 `py -3 bpmv.py setup`） | `python bpmv.py doctor` |
| macOS / Linux | `python3 bpmv.py setup` | `python3 bpmv.py doctor` |
| 歌曲模式另需 | 加 `--audio`（faster-whisper + demucs + torch，约 2 GB） | doctor 中 `faster_whisper`、`demucs` 显示 `[OK]` |
`setup` = `npm install`（skia-canvas，含 win-x64/mac/linux 预编译）+ `pip install -r requirements.txt`，最后自动运行 doctor。
WSL 也可用，但所有依赖都要装在 WSL 里，路径用 `/mnt/c/...`，不要混用 Windows 的 Python。

## 路径
- 路径含空格必须加英文双引号。中文路径可以用。
- Windows 路径尽量短（如 `D:\ballpen\sun`），避免超过 200 字符。
- 项目文件夹不要放在 Skill 文件夹里面。

## 字体 {#fonts}
- 默认手写字体：随包 **Yozai（悠哉字体）**，SIL OFL 1.1，许可证 `licenses/OFL-Yozai.txt`。覆盖简体、繁体、日文假名、拉丁字母。
- project.json 里指定的字体文件不存在或不可用时，会**自动回退到 Yozai** 并打印 `WARN font fallback`，不会中断制作。
- `bpmv.py script` 会检查每个字是否有字形（需要 fontTools，setup 已安装）；提示 `has no glyph for: X` 时：改写这些字，或加一个包含它们的 OFL 字体：
  ```json
  "fonts": [{"family": "MyHand", "file": "fonts/MyHand.ttf"}], "hand_font": "MyHand"
  ```
  可选：`python scripts/fetch_fonts.py --longcang`（mac/Linux 用 `python3`）下载 LongCang（OFL，毛笔风）。
- 不要把商业字体放进包里分发；只能引用用户自己电脑上有授权的字体文件。

## 已验证
2026-10 在 Linux x64（Node 20、Python 3.13、ffmpeg 6）完成全部测试（风格 A/B/C/D、四种配乐模式）。Windows 上以同一份包安装，命令入口与路径处理按上表设计；首次在 Windows 出片请先跑一个 20 秒 `sample` 验证。
