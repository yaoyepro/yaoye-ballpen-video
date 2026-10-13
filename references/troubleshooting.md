# 常见问题与修复（troubleshooting）

命令里的 `python`：Windows 用 `python` 或 `py -3`；macOS/Linux 用 `python3`。

## 1. 安装 / doctor
| 现象 | 原因 | 修复 |
|---|---|---|
| `'python' 不是内部或外部命令` / `command not found` | 没装 Python 或不在 PATH | Windows：`winget install Python.Python.3.12` 后重开终端，或改用 `py -3`；mac：`brew install python` |
| `[!!] node -> install Node.js >= 18` | 没装 Node | 见 compatibility.md 安装表，重开终端 |
| `[!!] skia-canvas -> run: npm install` | 依赖没装 | 在 Skill 文件夹运行 `python bpmv.py setup` |
| `npm install` 卡住或 `ETIMEDOUT` | 网络/代理 | 设置代理后重试：PowerShell `$env:HTTPS_PROXY="http://127.0.0.1:<代理端口>"`；mac/Linux `export HTTPS_PROXY=http://127.0.0.1:<代理端口>`（端口换成你的） |
| `[!!] ffmpeg` | 没装 ffmpeg | Windows `winget install Gyan.FFmpeg`，**重开终端**；mac `brew install ffmpeg` |
| `[!!] python cv2/numpy...` | pip 依赖缺失 | `python -m pip install -r requirements.txt` |
| `error: externally-managed-environment`（PEP 668，mac Homebrew / Ubuntu 系统 Python） | 系统 Python 禁止直接 pip | `setup` 会自动改用 `--user --break-system-packages` 重试（只装到当前用户目录）；手动：`python3 -m pip install --user --break-system-packages -r requirements.txt`；或先建虚拟环境 `python3 -m venv .venv` 再用 `.venv/bin/python bpmv.py setup` |
| `[--] faster_whisper` | 只在歌曲模式需要 | 文字模式忽略；歌曲模式 `python bpmv.py setup --audio` |
| 中文显示乱码 | Windows 控制台编码 | CMD `set PYTHONUTF8=1`；PowerShell `$env:PYTHONUTF8=1` |

## 2. `bpmv.py script` 报错
| 信息 | 修复 |
|---|---|
| `script.json still has TODO markers` | 你还没把骨架写完，按 script-examples.md 写完整 |
| `line too long for handwriting (N units > 16)` | 拆成两行或两页（每行 ≤ 12 个汉字） |
| `max 4 text lines per page` | 拆页 |
| `unknown doodle 'x'` / `unknown extra doodle 'x'` | 只用 `work/script_brief.md` 清单里的名字 |
| `the first page cannot use small_erase` | 第 1 页改 `flip` |
| `sprite 'x' not in project.json sprites` | 在 project.json 的 `"sprites"` 加 `"x": {"height": 450}` |
| `sprite 'x' not prepped` | 运行 `python bpmv.py prep -p ...` |
| `poem lines missing or changed` | 诗句必须和 `work/source.txt` 每行完全相同（含标点） |
| `copy mode: ... first difference at char N` | 文案被改了；按提示的位置改回原文（空格和标点不计） |
| `WARN target_duration ... not reachable` | 差 > 10%：太短就加页，太长就减页/减行 |
| `WARN font ... has no glyph for: X` | 这些字字体里没有；换字或换字体（compatibility.md） |
| `WARN long line ... will be written smaller` | 可接受；想要大字就拆行 |

## 3. build / stills
| 信息 | 修复 |
|---|---|
| `no free space for extra "x" on p3` | 那页太满：删一个 extras，或换 layout |
| `pen busy during eraser/flip` / overlap 警告（手写 scenes.js 时） | 两个笔划任务时间重叠或离转场 < 0.3 秒；挪开时间 |
| `scene build failed: ReferenceError ...` | scenes.js 语法/名字错误；脚本模式把 scenes.js 恢复成 `function build(){ autoBuild(); }` |
| 静帧里文字被排线盖住 | 不应发生；如发生，把该页 `background` 改成 `"ground"` 并报告 |
| 静帧里主画太小 | 在 `main` 里加 `"size": 500`（像素，最大约 600） |

## 4. sample / render
| 信息 | 修复 |
|---|---|
| `refuses to start while build warnings exist` | 先修 build 警告（第 3 节） |
| 渲染中断 / 电脑重启 | 重新运行同一条 render 命令，会从已完成的分块继续 |
| 内存不足 / 很卡 | 在 project.json 设 `"render": {"workers": 2}`，或加 `--fps 30` |
| `no rendered video track ... run render first`（mux 时） | 先 render 同一个 fps；或 `--fps 30` 与 render 时一致 |
| 视频没有声音 | `music.mode` 是 `none` 且 `foley.enabled` 是 false → 这是静音片；需要声音就开 foley 或换 auto |
| 响度不是 -16 | 只有 auto/external 会标准化；none+笔声约 -20 LUFS 属正常 |

## 5. 歌曲模式
| 现象 | 修复 |
|---|---|
| 歌词时间偏差 0.5 秒以上 | 改 `work/timeline.json` 的 `song_start/song_end`，加 `"locked": true` |
| 有句子没识别到（`confidence` 不是 high） | 听原歌对应位置，手动填时间 |
| timeline 太慢 | project.json `"asr": {"model": "medium"}`（更快、略不准） |

还解决不了：把完整报错、运行的命令、系统（Windows/mac/Linux）告诉用户，不要手改 `build/mv.js` 或 `engine/`。
