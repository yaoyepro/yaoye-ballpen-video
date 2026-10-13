# Fonts

| file | family | license | redistributable | source |
|---|---|---|---|---|
| Yozai-Regular.ttf (bundled, unmodified v0.868) | Yozai (悠哉字体) | SIL OFL 1.1 — see OFL-Yozai.txt | yes (with license, not sold alone) | https://github.com/lxgw/yozai-font |
| LongCang-Regular.ttf (optional, `python scripts/fetch_fonts.py --longcang`) | LongCang | SIL OFL 1.1 | yes | https://github.com/google/fonts/tree/main/ofl/longcang |

Yozai is the default handwriting font for lyrics, titles and credits (CJK + Latin). It covers Simplified/Traditional Chinese and Japanese kana.
For other scripts add any OFL handwriting font to project.json:

    "fonts": [{"family": "MyHand", "file": "fonts/MyHand.ttf"}], "hand_font": "MyHand"

Do NOT ship commercial fonts (e.g. most Founder/Hanyi faces) inside a package; reference a local file path instead.
Fonts used in earlier experiments but NOT bundled: LXGW WenKai, Xiaolai, ZCOOL KuaiLe/XiaoWei, Ma Shan Zheng, Zhi Mang Xing (all OFL, large; fetch from their upstream repos if wanted) and ChillZhuo (check its own license before use).
