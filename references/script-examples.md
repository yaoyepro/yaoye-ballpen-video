# script.json 完整范例（可直接复制）

每个范例都已在本包实测通过 `bpmv.py script` + `build`（warnings: none）。用法：
1. `python bpmv.py init <项目>`（mac/Linux 用 `python3`）
2. `python bpmv.py script -p <项目>/project.json <下面的输入参数>` —— 生成骨架和 `work/script_brief.md`
3. 把下面对应的 JSON 复制到 `<项目>/script.json`，**把文字、涂鸦换成本次内容**
4. `python bpmv.py script -p <项目>/project.json` —— 校验并计时

文件也在 `examples/scripts/` 里（`*.script.json` 与 `*.source.txt`）。字段说明见 [SCRIPT_SCHEMA.md](SCRIPT_SCHEMA.md)。

## 主题（theme）· 风格 A

输入参数：`--input theme --text "和太阳奔跑" --title "和太阳奔跑"`

原文（source.txt）：
```text
和太阳奔跑
```

要点：你写原创文案：5 页，起→承→转→合；每页主画直接画出这句话（日出、运动鞋、路、太阳）。第 3 页用 small_erase 在运动鞋画面上换字。

```json
{
 "version": 1,
 "input_mode": "theme",
 "title": "和太阳奔跑",
 "subtitle": "",
 "pace": "normal",
 "mood": "bright, hopeful, light running rhythm; warm morning to golden evening",
 "target_duration": 33,
 "title_card": {
  "doodles": [
   "sun"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "清晨，太阳敲我的窗"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "sunrise"
   },
   "extras": [
    "birds"
   ],
   "background": "sky",
   "transition": "flip",
   "mood": "waking up, gentle"
  },
  {
   "id": "p2",
   "text": [
    "系好鞋带",
    "我们出发吧"
   ],
   "layout": "text-right",
   "main": {
    "doodle": "sneaker"
   },
   "extras": [
    "speed"
   ],
   "background": [
    "wash",
    "ground"
   ],
   "transition": "erase",
   "mood": "excited start"
  },
  {
   "id": "p3",
   "text": [
    "风在耳边唱歌"
   ],
   "extras": [
    "wind"
   ],
   "transition": "small_erase",
   "mood": "running, airy"
  },
  {
   "id": "p4",
   "text": [
    "影子追着我",
    "跑过整条小路"
   ],
   "layout": "text-top",
   "main": {
    "doodle": "road"
   },
   "extras": [
    "footprints",
    "flower"
   ],
   "transition": "flip",
   "mood": "playful chase",
   "background": "ground"
  },
  {
   "id": "p5",
   "text": [
    "太阳笑着说：",
    "明天还一起跑！"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "sun"
   },
   "extras": [
    "heart"
   ],
   "background": "sky",
   "transition": "erase",
   "mood": "warm, golden, resolving"
  }
 ],
 "end_card": {
  "text": "一起奔跑吧",
  "doodles": [
   "hearts"
  ],
  "transition": "erase"
 }
}
```

## 关键词（keywords）· 风格 A

输入参数：`--input keywords --file keywords.txt --title "雨天的书店"`

原文（source.txt）：
```text
雨天, 书店, 热可可, 旧信
```

要点：4 个关键词全部出现：雨天（rain/umbrella）、书店（house/book）、热可可（cup）、旧信（letter）。

```json
{
 "version": 1,
 "input_mode": "keywords",
 "title": "雨天的书店",
 "subtitle": "",
 "pace": "calm",
 "mood": "cozy, rainy afternoon, warm and quiet",
 "target_duration": 30,
 "title_card": {
  "doodles": [
   "umbrella"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "下雨了",
    "街角的书店还亮着"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "house"
   },
   "extras": [
    "rain"
   ],
   "background": [
    "wash",
    "ground"
   ],
   "transition": "flip",
   "mood": "rain, calm"
  },
  {
   "id": "p2",
   "text": [
    "翻开一本旧书"
   ],
   "layout": "text-right",
   "main": {
    "doodle": "book"
   },
   "extras": [
    "sparkle"
   ],
   "background": "ground",
   "transition": "erase",
   "mood": "curious"
  },
  {
   "id": "p3",
   "text": [
    "书里夹着一封旧信"
   ],
   "extras": [
    "letter"
   ],
   "transition": "small_erase",
   "mood": "surprise"
  },
  {
   "id": "p4",
   "text": [
    "热可可慢慢变凉",
    "雨也停了"
   ],
   "layout": "text-top",
   "main": {
    "doodle": "cup"
   },
   "extras": [
    "heart"
   ],
   "background": "ground",
   "transition": "flip",
   "mood": "warm, resolving"
  }
 ],
 "end_card": {
  "text": "下次雨天见",
  "doodles": [
   "umbrella"
  ],
  "transition": "erase"
 }
}
```

## 用户文案（copy）· 风格 A

输入参数：`--input copy --file copy.txt --title "窗台上的小花"`

原文（source.txt）：
```text
每天早上七点，我都会给窗台上的小花浇水。它不说话，却一天比一天高。原来认真生活的样子，就是这么安静。
```

要点：原文一字不改，只断行分页、去掉行末标点；`bpmv.py script` 会逐字比对（忽略空格和标点）。

```json
{
 "version": 1,
 "input_mode": "copy",
 "title": "窗台上的小花",
 "subtitle": "",
 "pace": "normal",
 "mood": "gentle, morning light, quiet growth",
 "target_duration": 28,
 "title_card": {
  "doodles": [
   "flower"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "每天早上七点",
    "我都会给窗台上的小花浇水"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "window"
   },
   "extras": [
    "sun"
   ],
   "background": "ground",
   "transition": "flip",
   "mood": "morning routine"
  },
  {
   "id": "p2",
   "text": [
    "它不说话"
   ],
   "layout": "text-right",
   "main": {
    "doodle": "sprout"
   },
   "extras": [
    "sparkle"
   ],
   "background": [
    "wash",
    "ground"
   ],
   "transition": "erase",
   "mood": "quiet"
  },
  {
   "id": "p3",
   "text": [
    "却一天比一天高"
   ],
   "extras": [
    "arrow"
   ],
   "transition": "small_erase",
   "mood": "growing"
  },
  {
   "id": "p4",
   "text": [
    "原来认真生活的样子",
    "就是这么安静"
   ],
   "layout": "text-top",
   "main": {
    "doodle": "flower"
   },
   "extras": [
    "heart"
   ],
   "background": "ground",
   "transition": "flip",
   "mood": "warm close"
  }
 ],
 "end_card": {
  "text": "",
  "doodles": [
   "hearts"
  ],
  "transition": "erase"
 }
}
```

## 诗（poem）· 风格 B

输入参数：`--input poem --file poem.txt --title "静夜思" --author "作者名"`

原文（source.txt）：
```text
床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。
```

要点：这是 `--input poem` 自动生成的结果（实测）。诗句含标点原样保留；可把第二次出现的 moon 换成 house/window 增加变化；作者写在 subtitle。

```json
{
 "version": 1,
 "input_mode": "poem",
 "title": "静夜思",
 "subtitle": "",
 "pace": "calm",
 "mood": "quiet, nostalgic, moonlit night",
 "title_card": {
  "doodles": [
   "moon"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "床前明月光，"
   ],
   "layout": "text-left",
   "transition": "flip",
   "mood": "quiet",
   "main": {
    "doodle": "moon"
   },
   "extras": [
    "stars"
   ],
   "background": [
    "night",
    "ground"
   ]
  },
  {
   "id": "p2",
   "text": [
    "疑是地上霜。"
   ],
   "layout": "text-left",
   "transition": "small_erase",
   "mood": "quiet",
   "extras": [
    "snowflake"
   ]
  },
  {
   "id": "p3",
   "text": [
    "举头望明月，"
   ],
   "layout": "text-right",
   "transition": "erase",
   "mood": "quiet",
   "main": {
    "doodle": "moon"
   },
   "extras": [
    "stars"
   ],
   "background": [
    "night",
    "ground"
   ]
  },
  {
   "id": "p4",
   "text": [
    "低头思故乡。"
   ],
   "layout": "text-right",
   "transition": "small_erase",
   "mood": "quiet",
   "extras": [
    "house"
   ]
  }
 ],
 "end_card": {
  "text": "",
  "doodles": [
   "sparkle"
  ],
  "transition": "erase"
 }
}
```

## 长文（article）· 风格 A

输入参数：`--input article --file article.txt --title "社区图书角改造记"`

原文（source.txt）：
```text
社区图书角改造记
去年九月，我们小区把一楼闲置的自行车棚改成了图书角。改造只用了三个周末，材料大多来自居民捐赠：二十张旧木板、六盏台灯和一千二百本书。图书角每天早上八点到晚上九点开放，不需要借书证，看完放回原处即可。半年下来，平均每天有四十多位居民来看书，其中一半是孩子。最受欢迎的是绘本和旅行类图书。下一步，大家打算在周末办一次“换书集市”，让每本书走得更远。
```

要点：压缩成 7 页、12 行；所有数字（三个周末、二十张、六盏、一千二百本、八点到九点、四十多位、一半）原样保留，没有新增事实。

```json
{
 "version": 1,
 "input_mode": "article",
 "title": "社区图书角改造记",
 "subtitle": "",
 "pace": "normal",
 "mood": "bright, community, hopeful",
 "target_duration": 45,
 "title_card": {
  "doodles": [
   "book"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "去年九月",
    "闲置的自行车棚变成了图书角"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "house"
   },
   "extras": [
    "sparkle"
   ],
   "background": "ground",
   "transition": "flip",
   "mood": "start"
  },
  {
   "id": "p2",
   "text": [
    "只用了三个周末"
   ],
   "layout": "text-right",
   "main": {
    "doodle": "clock"
   },
   "extras": [
    "arrow"
   ],
   "background": "ground",
   "transition": "erase",
   "mood": "busy"
  },
  {
   "id": "p3",
   "text": [
    "二十张旧木板 六盏台灯",
    "一千二百本书 都来自居民"
   ],
   "extras": [
    "hearts"
   ],
   "transition": "small_erase",
   "mood": "together"
  },
  {
   "id": "p4",
   "text": [
    "早八点到晚九点开放",
    "不用借书证 看完放回原处"
   ],
   "layout": "text-top",
   "main": {
    "doodle": "lamp"
   },
   "extras": [
    "book"
   ],
   "background": [
    "wash",
    "ground"
   ],
   "transition": "flip",
   "mood": "open, easy"
  },
  {
   "id": "p5",
   "text": [
    "每天四十多位居民来看书",
    "一半是孩子"
   ],
   "layout": "text-left",
   "main": {
    "doodle": "book"
   },
   "extras": [
    "star"
   ],
   "background": "ground",
   "transition": "erase",
   "mood": "lively"
  },
  {
   "id": "p6",
   "text": [
    "最受欢迎：绘本和旅行书"
   ],
   "extras": [
    "plane"
   ],
   "transition": "small_erase",
   "mood": "joy"
  },
  {
   "id": "p7",
   "text": [
    "下一步：周末换书集市",
    "让每本书走得更远"
   ],
   "layout": "text-right",
   "main": {
    "doodle": "road"
   },
   "extras": [
    "footprints"
   ],
   "background": "ground",
   "transition": "flip",
   "mood": "hopeful close"
  }
 ],
 "end_card": {
  "text": "欢迎来看书",
  "doodles": [
   "heart"
  ],
  "transition": "erase"
 }
}
```

## 角色叙事（任意文字 + 图片）· 风格 C

输入参数：`--input theme --text "晚安，小星星" --title "晚安，小星星"`

要点：本包**不附带任何角色图片**，这个范例必须用你自己的图（或按 SKILL.md 第 5 节的提示词生成的图）。先把 my_happy.png、my_sleepy.png 放进 sprites/，project.json 写 `"sprites": {"my_happy": {"height": 440}, "my_sleepy": {"height": 470}}`，运行 prep。缺图时 `script` 会报错并提示你放图。主画用 `{"sprite": "名字"}`。

```json
{
 "version": 1,
 "input_mode": "theme",
 "title": "晚安，小星星",
 "subtitle": "",
 "pace": "calm",
 "mood": "tender lullaby, warm, sleepy night",
 "target_duration": 22,
 "title_card": {
  "doodles": [
   "moon"
  ]
 },
 "pages": [
  {
   "id": "p1",
   "text": [
    "今天也笑了好多次"
   ],
   "layout": "text-left",
   "main": {
    "sprite": "my_happy"
   },
   "extras": [
    "hearts"
   ],
   "background": [
    "wash",
    "ground"
   ],
   "transition": "flip",
   "mood": "playful"
  },
  {
   "id": "p2",
   "text": [
    "星星亮了",
    "该睡觉啦"
   ],
   "layout": "text-right",
   "main": {
    "sprite": "my_sleepy"
   },
   "extras": [
    "stars"
   ],
   "background": [
    "night",
    "ground"
   ],
   "transition": "erase",
   "mood": "lullaby"
  }
 ],
 "end_card": {
  "text": "晚安",
  "doodles": [
   "moon"
  ],
  "transition": "erase"
 }
}
```

## 歌（song）· 风格 D —— 不用 script.json

`python bpmv.py init <项目> --mode song`，然后：

`project.json`（关键字段）：
```json
{
 "title": "歌名",
 "audio": "audio/song.mp3",
 "lyrics": "lyrics.txt",
 "language": "zh",
 "lead_in": 1.0,
 "fps": 60,
 "sprites": {
  "my_happy": {
   "height": 440
  },
  "my_sleepy": {
   "height": 470
  }
 },
 "credits": [
  "词：……",
  "曲：……"
 ],
 "output_name": "my_song_mv"
}
```

`lyrics.txt`（按实际演唱，一行一句，重复段落也写出来）：
```text
[Verse 1]
第一句歌词
第二句歌词
[Chorus]
副歌第一句
副歌第二句
副歌第一句
副歌第二句
```

之后：`timeline` → 核对 `work/timeline_review.md`（⛔）→ `prep` → 按 SCENE_API.md 写 scenes.js（范例 `examples/demo/scenes.js`）。
