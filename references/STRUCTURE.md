# STRUCTURE.md — film building blocks (script mode)

A script-mode film is assembled from fixed blocks; `script.json` only chooses and fills them.

```
title card ─▶ sheet 1 ─(flip|erase)─▶ sheet 2 ─(small_erase)─▶ sheet 2' ─(flip|erase)─▶ … ─▶ end card
```

## 1. Blocks
| block | content (pen order) | timing source |
|---|---|---|
| **title card** | title (big, centred, ruled line 5) → red underline → subtitle/author (line 8) → title-card doodles (first one big & shaded, on the ground line if it is a ground object) → ground line → credits | `title_card` |
| **sheet** | text lines (written on ruled lines) → ONE main drawing (character image or doodle, outline then 2-layer hatching) → 0–4 small doodle extras (auto-placed in free space) → background | one entry in `pages` |
| **continuation** (`small_erase`) | small eraser rubs the previous text lines out, the drawing stays → new text → new extras | a page with `"transition":"small_erase"` |
| **end card** | (logo) → closing text → doodles (e.g. hearts) → hold | `end_card` |
After everything on a page is drawn it **holds** (reading time, ≥ 0.75 s) while drawings keep their calm idle motion.

## 2. Transitions
| `transition` (of the page it OPENS) | meaning |
|---|---|
| `flip` | page turn to a new sheet (first page always flips/erases in from the title card) |
| `erase` | big eraser wipes the whole sheet, new sheet underneath |
| `small_erase` | same sheet: only the text is rubbed out; `main`/`background` of this page are ignored, `extras` are added |
Alternate `flip` and `erase`; use `small_erase` for 2-part thoughts on the same picture.

## 3. Layout templates (1920×1080, `GROUND`=1000, `RULE(n)` = 150+44·(n−1)… baseline of ruled line n)
| layout | text slots | art box (main drawing) | ground line |
|---|---|---|---|
| `text-left` (default) | x=200, left-aligned, lines RULE(2),RULE(4),… width ≤ 860 | [760, below text, 1820, 1000] | yes |
| `text-right` | x=1060, left-aligned, width ≤ 760 | [180, below text, 1120, 1000] | yes |
| `text-top` | centred at x=960, width ≤ 1500 | [420, below text, 1500, 1000] | yes |
| `text-bottom` | centred near the bottom (RULE 19 upward) | [420, 190, 1500, above text] | no |
| `art-center` | like text-bottom, art first in the eye | [420, 180, 1500, above text] | no |
| `text-only` | centred, size 84, from RULE(10) upward | none | no |
Text that is too wide is shrunk (`fitSize`, min 40 px). Main doodle size = min(0.82·art height, 0.86·art width/aspect, 600 px).
Ground-kind doodles stand on the ground line; sky-kind ones float high; extras avoid text, the main drawing, the margin,
the logo and each other (`placeExtra`, up to 500 candidate spots; failures are reported as build warnings).
Extras added on a `small_erase` continuation are drawn after the background, so on `wash`/`night` sheets they sit on the hatching.

## 4. Backgrounds (`background`, string or list)
| value | look | default for |
|---|---|---|
| `ground` | one long wobbly pen line across the page at y=1000 (gaps where drawings stand on it) | text-left/right/top |
| `wash` | light 2-layer cross-hatching over the whole page above the ground line, clean paper patch around the main drawing, text (incl. text written later after a small eraser) and extras — the richest look, like a finished notebook page | — (recommended for 1–2 key pages) |
| `sky` | a loose noisy halo of 52° hatching around the main drawing (not on its strokes, not on text) | — |
| `night` | full-page 3-layer cross-hatching, glows left around moon/stars/lamps, halo around text | moon / star pages |
| `none` | clean paper | text-bottom/art-center/text-only |

## 5. Main drawing sources (priority)
1. user images (project `sprites`, traced by `prep`) → `"main": {"sprite": "name"}`
2. images the agent generates with its image tool (prompt template in SKILL.md) → cutout → prep → same as 1
3. a doodle from the library → `"main": {"doodle": "name"}` — objects/nature/marks only, **never characters**
Characters are optional: a doodle-only film is fine for themes, poems and articles.

## 6. Doodle library (`engine/doodles.js`)
`doodle(name, cx, cy, size, seed)` returns `{items, inside, hatchC, anim, kind, box}`; add new ones with
`regD(name,{kind,anim,hatch,tags},fn)` (keep them to objects/nature, simple closed outlines, ≤ ~40 strokes). `tags` are
used to auto-pick doodles from poem keywords. kind: sky = floats high · ground = stands on the ground line · object/mark = free.

| name | kind | shaded | idle anim | tags |
|---|---|---|---|---|
| `sun` | sky | yes | pulse | 太阳 阳光 日出 夏天 sun sunny morning warm |
| `moon` | sky | yes | sway | 月亮 月光 明月 夜 晚安 moon night |
| `star` | sky | - | twinkle | 星星 梦想 希望 star dream wish |
| `sparkle` | sky | - | twinkle | 闪光 亮 sparkle shine |
| `stars` | sky | - | pulse | 星空 夜空 stars |
| `cloud` | sky | - | flow | 云 天空 白云 cloud sky |
| `rain` | sky | - | - | 雨 下雨 rain |
| `snowflake` | sky | - | twinkle | 雪 霜 冬天 冷 snow frost winter |
| `birds` | sky | - | bob | 鸟 飞 自由 birds fly freedom |
| `planet` | sky | yes | sway | 星球 宇宙 太空 planet space universe |
| `rocket` | sky | yes | bob | 火箭 出发 梦想 rocket launch future |
| `balloon` | sky | yes | bob | 气球 庆祝 生日 balloon party birthday |
| `kite` | sky | yes | sway | 风筝 风 春天 kite wind spring |
| `plane` | sky | - | bob | 纸飞机 远方 出发 paper plane journey message |
| `wind` | mark | - | flow | 风 微风 吹 wind breeze |
| `speed` | mark | - | flow | 速度 奔跑 快 speed run fast |
| `arrow` | mark | - | - | 箭头 方向 前进 arrow direction next |
| `underline` | mark | - | - | 下划线 强调 underline |
| `spiral` | mark | - | spin | 旋转 漩涡 时间 spiral swirl time |
| `heart` | object | yes | pulse | 爱 心 喜欢 温暖 heart love warm |
| `hearts` | object | - | pulse | 爱心 hearts |
| `note` | object | - | bob | 音乐 歌 唱 music song sing |
| `footprints` | ground | - | - | 脚印 足迹 路 走 footprints path walk |
| `flower` | ground | - | sway | 花 春天 开花 flower spring bloom |
| `sprout` | ground | - | sway | 发芽 成长 希望 植物 sprout grow plant hope |
| `grass` | ground | - | sway | 草 草地 grass field |
| `tree` | ground | yes | sway | 树 森林 公园 tree forest park |
| `leaf` | object | - | sway | 叶子 秋天 leaf autumn |
| `mountain` | ground | yes | - | 山 远方 旅行 mountain travel far |
| `wave` | ground | - | flow | 海 浪 河 水 sea wave river water |
| `horizon` | ground | - | - | 地平线 田野 远方 horizon field |
| `sunrise` | ground | yes | - | 日出 黎明 开始 sunrise dawn start |
| `road` | ground | - | - | 路 道路 远方 前进 road way future |
| `house` | ground | yes | - | 家 房子 回家 故乡 乡 home house hometown |
| `window` | object | yes | - | 窗 窗户 夜晚 window |
| `lamp` | ground | - | - | 路灯 夜 街 lamp street night |
| `book` | object | - | - | 书 读 学习 知识 book read study |
| `cup` | object | yes | - | 咖啡 茶 杯子 早晨 cup coffee tea |
| `clock` | object | - | - | 时钟 时间 等待 clock time wait |
| `bulb` | object | - | pulse | 灯泡 想法 灵感 idea bulb inspiration |
| `umbrella` | object | yes | sway | 伞 雨天 保护 umbrella rain protect |
| `letter` | object | - | - | 信 信封 想念 letter mail miss |
| `sneaker` | ground | yes | - | 运动鞋 跑步 出发 sneaker running shoe |
| `city` | ground | yes | - | 城市 高楼 赛博朋克 霓虹 city skyline cyberpunk urban |
| `circuit` | mark | - | - | 电路 科技 赛博 数据 circuit tech cyber data |
| `chip` | object | yes | pulse | 芯片 AI 机器 chip ai machine |
| `fence` | ground | - | - | 篱笆 院子 fence yard |
| `pagoda` | ground | - | - | 塔 古 中国 pagoda ancient |
| `lantern` | object | - | sway | 灯笼 节日 lantern festival |
| `butterfly` | sky | - | butterfly | 蝴蝶 春天 butterfly spring |

## 7. Hand-tuning hooks (`scenes.js`)
```js
function build(){
  autoBuild({
    after:  { p2:(P,pg,ctx)=>{ const h=heart(1500,300,30,7); addPlan(P,[h],pg.t1-1.6,pg.t1-1.3); } },   // add things
    replace:{ p4:(P,pg,ctx)=>{ /* draw this sheet yourself with the Scene API; pg.steps has the planned times */ } }
  });
}
```
`pg` is the planned page from `work/plan.json` (`t0,t1,enter,layout,steps[{op,ts,te,…}]`); `ctx` exposes what was built
(`texts`, `main`, `sprite`, `extras`, `layout`). Keep the one-pen rule (no overlapping tasks; idle ≥ 0.3 s before
the page's `t1`). Full API: `references/SCENE_API.md`.
