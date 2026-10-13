"""Download the handwriting fonts (SIL OFL 1.1) into fonts/.  python scripts/fetch_fonts.py [--longcang]
Yozai (悠哉) is bundled already; this restores it if missing and optionally adds LongCang (brush-style alternative)."""
import hashlib, os, sys, urllib.request
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")
FONTS = {
    "Yozai-Regular.ttf": ("https://github.com/lxgw/yozai-font/releases/download/v0.868/Yozai-Regular.ttf",
                          "25071998a0fe6a72f54c235e714986d259633e5ff670b1a2b5e264387f3316ac"),
    "OFL-Yozai.txt": ("https://raw.githubusercontent.com/lxgw/yozai-font/main/OFL.txt", None),
    "LongCang-Regular.ttf": ("https://github.com/google/fonts/raw/main/ofl/longcang/LongCang-Regular.ttf",
                             "e5bf2c3f24ef2327c6f136d8f73e2f9dfdf44896fdbeb35a9515f44777bb91bc"),
    "OFL-LongCang.txt": ("https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/OFL.txt", None),
}
want = ["Yozai-Regular.ttf", "OFL-Yozai.txt"] + (["LongCang-Regular.ttf", "OFL-LongCang.txt"] if "--longcang" in sys.argv else [])
for name in want:
    url, sha = FONTS[name]; dst = os.path.join(D, name)
    if os.path.exists(dst): print("have", name); continue
    print("download", url); urllib.request.urlretrieve(url, dst + ".part")
    if sha and hashlib.sha256(open(dst + ".part", "rb").read()).hexdigest() != sha:
        os.remove(dst + ".part"); sys.exit("checksum mismatch for " + name)
    os.replace(dst + ".part", dst); print("ok", name)
