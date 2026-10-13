"""Script mode: any text input (theme / keywords / copy / poem / article) -> script.json -> timed plan, no song needed.

The CLI cannot write copy itself. Workflow:
  1. `bpmv.py script --input theme|keywords|copy|poem|article (--text "..." | --file x.txt) [--title ..] [--author ..]`
       saves the input to work/source.txt and writes work/script_brief.md (rules, schema, doodle catalogue, the source).
       poem  : script.json is generated automatically (lines kept VERBATIM, doodles picked from keywords) - review it.
       others: a skeleton script.json with TODO markers is written; the running agent authors it following the brief.
  2. `bpmv.py script` (again, once script.json has no TODO) validates it and writes
       work/plan.json (all timings), work/timeline.json (on-screen text lines, same format as lyric mode),
       work/music_brief.md (timing sheet for a composer / music agent) and scenes.js (if missing: autoBuild()).
Timings are reading-speed based (write time per character + hold time per page), scaled by "pace" and "target_duration".
"""
import json, os, re, sys
from common import SKILL_DIR, die

INPUT_MODES = ("theme", "keywords", "copy", "poem", "article")
LAYOUTS = ("text-left", "text-right", "text-top", "text-bottom", "art-center", "text-only")
TRANSITIONS = ("flip", "erase", "small_erase")
BACKGROUNDS = ("none", "sky", "wash", "night", "ground")
PACE = {"calm": 1.2, "normal": 1.0, "lively": 0.85}
CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]")

def doodle_catalog():
    src = open(os.path.join(SKILL_DIR, "engine", "doodles.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"regD\('(\w+)',\{kind:'(\w+)'(.*?)tags:'([^']*)'\}", src):
        name, kind, mid, tags = m.groups()
        h = re.search(r"hatch:'(\w)'", mid)
        out[name] = {"kind": kind, "hatch": bool(h), "tags": tags}
    return out

def text_units(s):
    """reading/writing length: CJK char = 1, latin char = 0.45, spaces/punctuation small"""
    n = 0.0
    for ch in s:
        if CJK.match(ch): n += 1
        elif ch.isalnum(): n += 0.45
        elif ch.strip(): n += 0.3
    return n

def write_time(s, f):
    return round(min(2.2, max(0.7 * min(1.0, f), 0.13 * text_units(s) * f)), 2)

# ------------------------------------------------------------------ brief / skeleton
SCHEMA_DOC = os.path.join(SKILL_DIR, "references", "SCRIPT_SCHEMA.md")

def guess_doodle(line, cat, used):
    best = None
    for name, d in cat.items():
        for tag in d["tags"].split():
            if CJK.match(tag[:1]) and tag in line or (not CJK.match(tag[:1]) and re.search(r"\b" + re.escape(tag) + r"\b", line, re.I)):
                score = len(tag) - (1 if name in used else 0)
                if best is None or score > best[0]: best = (score, name)
    return best[1] if best else None

def poem_script(lines, title, author, cat):
    pages = []; used = []; layouts = ["text-left", "text-right", "text-top", "text-left", "text-right"]
    fallback = ["moon", "cloud", "leaf", "star", "wind", "mountain", "house"]
    per = 2 if len(lines) > 8 else 1
    groups = [lines[i:i + per] for i in range(0, len(lines), per)]
    for k, g in enumerate(groups):
        main = guess_doodle("".join(g), cat, used) or next(x for x in fallback + list(cat) if x not in used)
        used.append(main)
        cont = k % 2 == 1 and per == 1           # every 2nd line: small eraser, same drawing gets an extra
        page = {"id": f"p{k+1}", "text": g, "layout": layouts[(k // (2 if per == 1 else 1)) % len(layouts)],
                "transition": "small_erase" if cont else ("flip" if k % 4 == 0 else "erase"),
                "mood": "quiet"}
        if cont:
            extra = guess_doodle("".join(g), cat, used[:-1] + [pages[-1].get("main", {}).get("doodle")]) or "sparkle"
            page["extras"] = [extra if extra != pages[-1].get("main", {}).get("doodle") else "sparkle"]
            page["layout"] = pages[-1]["layout"]
        else:
            page["main"] = {"doodle": main}
            page["extras"] = ["stars"] if main == "moon" else ["sparkle"]
            page["background"] = ["night", "ground"] if main in ("moon", "star", "stars") else "ground"
        pages.append(page)
    return {"version": 1, "input_mode": "poem", "title": title or "", "subtitle": author or "", "pace": "calm",
            "mood": "quiet, nostalgic, moonlit night", "title_card": {"doodles": ["moon"]},
            "pages": pages, "end_card": {"text": "", "doodles": ["sparkle"], "transition": "erase"}}

def skeleton(mode, title):
    return {"version": 1, "input_mode": mode, "title": title or "TODO title (short)", "subtitle": "", "pace": "normal",
            "mood": "TODO overall mood for the music brief", "target_duration": None,
            "title_card": {"doodles": ["TODO doodle name, e.g. sun"]},
            "pages": [{"id": "p1", "text": ["TODO short line 1", "TODO short line 2"], "layout": "text-left",
                       "main": {"doodle": "TODO doodle name"}, "extras": ["TODO"], "background": "ground",
                       "transition": "flip", "mood": "TODO"}],
            "end_card": {"text": "TODO e.g. 完 / The End / a closing line", "doodles": ["heart"], "transition": "erase"}}

def write_brief(prj, mode, src, cat):
    sprites = sorted(prj.cfg.get("sprites", {}))
    lines = [f"# Script brief  (input mode: {mode})", "",
             "You (the agent) author `script.json` in the project folder. Then run `python bpmv.py script -p project.json` again.",
             "Schema + rules: references/SCRIPT_SCHEMA.md (summary below).", "",
             "## Rules for this input mode"]
    rules = {
        "theme": ["Write ORIGINAL copy for the theme: 5-9 pages, 1-2 lines per page, each line <= 12 CJK chars (<= 24 Latin chars).",
                  "Arc: opening image -> 2-4 development pages -> a turn/climax -> warm closing page. Concrete images, not slogans.",
                  "Each page has ONE clear main drawing (doodle or provided character image) that matches its line."],
        "keywords": ["Every keyword appears (or is clearly pictured) on at least one page; write connecting copy around them.",
                     "4-8 pages, 1-2 lines per page, <= 12 CJK / 24 Latin chars per line."],
        "copy": ["The user's own copy (文案): keep EVERY word VERBATIM and in order. You may only split it into short lines/pages",
                 "(<= 12 CJK / 24 Latin chars per line, 1-3 lines per page) and drop line-end punctuation. No rewording, no additions.",
                 "`bpmv.py script` checks this: the on-screen text (spaces/punctuation ignored) must equal the source text."],
        "poem": ["Keep every line VERBATIM (same characters, same punctuation, same order). Do not add or translate lines.",
                 "1 line per page (<= 8 lines) or 1 couplet per page; title + author on the title card."],
        "article": ["Condense into 6-12 pages of short lines (<= 14 CJK / 28 Latin chars), 1-3 lines per page.",
                    "Keep the article's key facts, numbers and names exactly; never invent facts. One idea per page.",
                    "Title = the article's title (shortened if needed)."],
    }[mode]
    lines += ["- " + r for r in rules]
    lines += ["- Prefer 'small_erase' to continue the same drawing with new text; alternate 'flip' and 'erase' between sheets.",
              "- Main drawing sources, in priority: provided character images (project sprites) -> character images you generate "
              "with your image tool (see SKILL.md prompt template, then cutout+prep) -> doodles below. Never draw people in code.",
              "", f"## Available sprites (prepped character images): {', '.join(sprites) or '(none - doodles only)'}", "",
              "## Doodle catalogue (name - kind - shading - tags)"]
    for n, d in cat.items():
        lines.append(f"- `{n}` - {d['kind']}{' - shaded' if d['hatch'] else ''} - {d['tags']}")
    lines += ["", "## Source input", "```", src.strip(), "```", ""]
    out = prj.p("work", "script_brief.md")
    open(out, "w", encoding="utf-8").write("\n".join(lines))
    return out

# ------------------------------------------------------------------ validation
def validate(sc, prj, cat):
    err, warn = [], []
    if not isinstance(sc.get("pages"), list) or not sc["pages"]: err.append("pages: need at least one page")
    if "TODO" in json.dumps(sc, ensure_ascii=False): err.append("script.json still contains TODO markers")
    if not str(sc.get("title", "")).strip(): warn.append("no title (title card will only show doodles)")
    if sc.get("pace", "normal") not in PACE: err.append(f"pace must be one of {list(PACE)}")
    sprites = prj.cfg.get("sprites", {})
    ids = set()
    for k, p in enumerate(sc.get("pages", [])):
        pid = p.get("id") or f"p{k+1}"; p["id"] = pid
        if pid in ids or pid in ("title", "end"): err.append(f"{pid}: duplicate/reserved id")
        ids.add(pid)
        txt = p.get("text", [])
        if isinstance(txt, str): txt = p["text"] = [txt]
        if not txt and not p.get("main"): err.append(f"{pid}: needs text or a main drawing")
        if len(txt) > 4: err.append(f"{pid}: max 4 text lines per page ({len(txt)})")
        for l in txt:
            u = text_units(l)
            if u > 16: err.append(f"{pid}: line too long for handwriting ({u:.0f} units > 16): {l}")
            elif u > 12.5: warn.append(f"{pid}: long line ({u:.0f} units) will be written smaller: {l}")
        lay = p.setdefault("layout", "text-left")
        if lay not in LAYOUTS: err.append(f"{pid}: layout must be one of {LAYOUTS}")
        tr = p.setdefault("transition", "flip" if k == 0 else "erase")
        if tr not in TRANSITIONS: err.append(f"{pid}: transition must be one of {TRANSITIONS}")
        if k == 0 and tr == "small_erase": err.append(f"{pid}: the first page cannot use small_erase")
        m = p.get("main")
        if m:
            if tr == "small_erase": warn.append(f"{pid}: small_erase continues the previous drawing - its 'main' is ignored")
            if "sprite" in m:
                if m["sprite"] not in sprites: err.append(f"{pid}: sprite '{m['sprite']}' not in project.json sprites - this package ships NO character images: put YOUR PNG in sprites/{m['sprite']}.png, declare it in project.json \"sprites\" and run `python bpmv.py prep` (SKILL.md section 5 has an image prompt), or use a doodle as main")
                elif not os.path.exists(prj.p("data", m["sprite"] + ".json")): err.append(f"{pid}: sprite '{m['sprite']}' not prepped (python bpmv.py prep)")
            elif m.get("doodle") not in cat: err.append(f"{pid}: unknown doodle '{m.get('doodle')}'")
            if lay == "text-only": warn.append(f"{pid}: text-only layout has no art area - main ignored")
        for e in p.get("extras", []) or []:
            n = e["name"] if isinstance(e, dict) else e
            if n not in cat: err.append(f"{pid}: unknown extra doodle '{n}'")
        if len(p.get("extras", []) or []) > 4: warn.append(f"{pid}: more than 4 extras looks busy")
        bg = p.get("background", "none")
        for b in (bg if isinstance(bg, list) else [bg]):
            if b not in BACKGROUNDS: err.append(f"{pid}: background must be from {BACKGROUNDS}")
    for d in (sc.get("title_card") or {}).get("doodles", []) + (sc.get("end_card") or {}).get("doodles", []):
        n = d["name"] if isinstance(d, dict) else d
        if n not in cat: err.append(f"title/end card: unknown doodle '{n}'")
    if sc.get("input_mode") == "poem" and os.path.exists(prj.p("work", "source.txt")):
        src = [l.strip() for l in open(prj.p("work", "source.txt"), encoding="utf-8") if l.strip()]
        got = [l for p in sc["pages"] for l in p.get("text", [])]
        body = [l for l in src if l in got or True]
        missing = [l for l in src if l not in got and l not in (sc.get("title"), sc.get("subtitle"))]
        if missing: err.append(f"poem lines missing or changed (must be verbatim): {missing}")
    if sc.get("input_mode") == "copy" and os.path.exists(prj.p("work", "source.txt")):
        norm = lambda t: re.sub(r"[\s\W_]+", "", t)
        src = norm(open(prj.p("work", "source.txt"), encoding="utf-8").read())
        got = norm("".join(l for p in sc["pages"] for l in p.get("text", [])))
        if src != got:
            k = next((i for i in range(min(len(src), len(got))) if src[i] != got[i]), min(len(src), len(got)))
            err.append(f"copy mode: on-screen text must equal the source word for word; first difference at char {k}: source '{src[k:k+12]}' vs script '{got[k:k+12]}'")
    if len(sc.get("pages", [])) > 20: warn.append("more than 20 pages - consider condensing")
    warn += glyph_warnings(sc, prj)
    return err, warn

def glyph_warnings(sc, prj):
    """characters the handwriting font cannot draw (needs fontTools; silently skipped without it)"""
    try:
        from fontTools.ttLib import TTFont
    except Exception:
        return []
    fam = prj.cfg.get("hand_font"); f = next((x for x in prj.cfg.get("fonts", []) if x.get("family") == fam), None)
    if not f or not os.path.exists(prj.p(f["file"])): return []
    cmap = TTFont(prj.p(f["file"]), lazy=True).getBestCmap() or {}
    txt = [sc.get("title", ""), sc.get("subtitle", ""), (sc.get("end_card") or {}).get("text", "")] + [l for p in sc.get("pages", []) for l in p.get("text", [])]
    miss = sorted({ch for t in txt for ch in str(t) if ch.strip() and ord(ch) not in cmap})
    return [f"font '{fam}' has no glyph for: {''.join(miss)} - rewrite those characters or add an OFL font that has them (references/compatibility.md#fonts)"] if miss else []

# ------------------------------------------------------------------ timing planner
def plan(sc, prj, cat):
    f = PACE[sc.get("pace", "normal")]
    T = prj.cfg.get("style", {}).get("transitions", {})
    FLIP, ERASE, SMALL = T.get("flip_s", .5), T.get("page_erase_s", .8), T.get("small_erase_s", .5)
    has_logo = bool(prj.cfg.get("logo"))
    pages, lines, holds = [], [], []
    t = 0.3
    # title card
    tc = sc.get("title_card") or {}
    title = {"id": "title", "kind": "title", "t0": 0.0}
    if sc.get("title"):
        d = round(min(2.4, max(1.0, .2 * text_units(sc["title"]) * f)), 2)
        title["title"] = {"text": sc["title"], "ts": t, "te": t + d}; t += d + .1
        title["underline"] = {"ts": t, "te": t + .35}; t += .45
    if sc.get("subtitle"):
        d = write_time(sc["subtitle"], f); title["subtitle"] = {"text": sc["subtitle"], "ts": t, "te": t + d}; t += d + .2
    title["doodles"] = []
    for dn in tc.get("doodles", []):
        n = dn["name"] if isinstance(dn, dict) else dn; d = .9 * f
        if not title["doodles"] and cat[n]["hatch"]: d += .7 * f   # first title doodle is big and shaded
        title["doodles"].append({"name": n, "ts": t, "te": t + d, "size": (dn.get("size") if isinstance(dn, dict) else None)}); t += d + .12
    if title["doodles"] or sc.get("title"):
        title["ground"] = {"ts": t, "te": t + .5 * f}; t += .5 * f + .1
    if prj.cfg.get("credits"): title["credits"] = {"ts": t, "te": t + .6}; t += .6
    h = (tc.get("hold") or 1.2) * f; holds.append([title, h]); t += h
    pages.append(title)
    li = 0; cur = title; sheet = None
    for k, p in enumerate(sc["pages"]):
        tr = p.get("transition", "flip")
        mood = p.get("mood") or sc.get("mood", "")
        if tr == "small_erase" and sheet is not None:
            prev_lines = [s["i"] for s in sheet["steps"] if s["op"] == "text" and s.get("seg") == sheet["seg"]]
            sheet["seg"] += 1
            if prev_lines:
                sheet["steps"].append({"op": "small_erase", "lines": prev_lines, "ts": round(t, 3), "te": round(t + SMALL, 3)}); t += SMALL + .2
            seg_start = t
        else:
            cur["t1"] = round(t, 3)
            d = FLIP if tr == "flip" else ERASE
            sheet = {"id": p["id"], "kind": "sheet", "layout": p.get("layout", "text-left"), "t0": round(t + d, 3),
                     "enter": {"type": tr if tr in ("flip", "erase") else "flip", "t0": round(t, 3), "t1": round(t + d, 3)},
                     "steps": [], "seg": 0, "nslots": 0, "segments": []}
            t += d + .25; pages.append(sheet); cur = sheet; seg_start = t - .25
        txt = p.get("text", [])
        sheet["nslots"] = max(sheet["nslots"], len(txt))
        for j, l in enumerate(txt):
            li += 1; d = write_time(l, f)
            sheet["steps"].append({"op": "text", "i": li, "slot": j, "seg": sheet["seg"], "ts": round(t, 3), "te": round(t + d, 3)})
            lines.append({"i": li, "text": l, "song_start": round(t, 3), "song_end": round(t + d, 3), "section": p["id"], "confidence": "script"})
            t += d + .3 * min(1.0, f)
        m = p.get("main")
        if m and tr != "small_erase" and sheet["layout"] != "text-only":
            if "sprite" in m: d = 3.6 * f; st = {"op": "main", "type": "sprite", "name": m["sprite"]}
            else:
                hatch = cat[m["doodle"]]["hatch"] and m.get("hatch", True)
                d = (1.5 + (.9 if hatch else 0)) * f; st = {"op": "main", "type": "doodle", "name": m["doodle"], "hatch": hatch}
                if m.get("size"): st["size"] = m["size"]
            st.update(ts=round(t, 3), te=round(t + d, 3)); sheet["steps"].append(st); t += d + .15
        for e in p.get("extras", []) or []:
            n = e["name"] if isinstance(e, dict) else e; d = .5 * f
            st = {"op": "extra", "name": n, "ts": round(t, 3), "te": round(t + d, 3)}
            if isinstance(e, dict) and e.get("size"): st["size"] = e["size"]
            sheet["steps"].append(st); t += d + .12
        bg = p.get("background", "ground" if sheet["layout"] in ("text-left", "text-right", "text-top") else "none"); bgl = [b for b in (bg if isinstance(bg, list) else [bg]) if b != "none"]
        if bgl and tr != "small_erase":
            d = sum({"sky": .9, "wash": 1.3, "night": 1.6, "ground": .5}[b] for b in bgl) * f
            sheet["steps"].append({"op": "bg", "type": bgl, "ts": round(t, 3), "te": round(t + d, 3)}); t += d + .1
        units = sum(text_units(l) for l in txt)
        h = p.get("hold") or min(4.5, max(1.4, .16 * units)) * f
        h = max(h, .75)
        if p.get("duration"): h = max(h, p["duration"] - (t - seg_start))
        sheet["segments"].append({"page": p["id"], "t0": round(seg_start, 3), "mood": mood, "text": txt,
                                  "transition": tr})
        holds.append([sheet, h]); t += max(.6, h)
    # end card
    ec = sc.get("end_card") or {}
    tr = ec.get("transition", "erase"); d = FLIP if tr == "flip" else ERASE
    cur["t1"] = round(t, 3)
    end = {"id": "end", "kind": "end", "t0": round(t + d, 3), "enter": {"type": tr, "t0": round(t, 3), "t1": round(t + d, 3)}, "doodles": []}
    t += d + .25
    if has_logo: end["logo"] = {"ts": t, "te": t + 1.4}; t += 1.5
    if ec.get("text"):
        dd = write_time(ec["text"], f) if text_units(ec["text"]) > 2 else .9
        end["text"] = {"text": ec["text"], "ts": round(t, 3), "te": round(t + dd, 3)}; t += dd + .15
    for dn in ec.get("doodles", []):
        n = dn["name"] if isinstance(dn, dict) else dn
        end["doodles"].append({"name": n, "ts": round(t, 3), "te": round(t + .45 * f, 3)}); t += .45 * f + .1
    t += (ec.get("hold") or 1.8)
    end["t1"] = round(t, 3); pages.append(end)
    total = round(t, 2)
    return pages, lines, total, holds

def retime(sc, prj, cat):
    """plan; with target_duration, scale every write/draw/hold time by one factor (0.6..1.8) so the film lands on the target"""
    tgt = sc.get("target_duration")
    base = PACE[sc.get("pace", "normal")]
    pages, lines, total, _ = plan(sc, prj, cat)
    if not tgt or abs(tgt - total) <= .5:
        return pages, lines, total
    lo, hi = 0.6, 1.8
    for _ in range(30):
        mid = (lo + hi) / 2
        PACE["_t"] = base * mid; sc2 = dict(sc, pace="_t")
        _, _, tot, _ = plan(sc2, prj, cat)
        if tot > tgt: hi = mid
        else: lo = mid
    PACE["_t"] = base * lo; sc2 = dict(sc, pace="_t")
    pages, lines, total, _ = plan(sc2, prj, cat)
    if abs(total - tgt) > max(1.0, .1 * tgt):
        print(f"WARN target_duration {tgt}s not reachable at sane speeds - planned {total:.1f}s (add/remove pages or lines)")
    else:
        print(f"timing scaled x{lo:.2f} for target_duration {tgt}s -> {total:.1f}s (title/transitions/end card are fixed)")
    return pages, lines, total

def music_brief(prj, sc, pages, total):
    pace = sc.get("pace", "normal"); bpm = {"calm": "68-84", "normal": "88-100", "lively": "108-124"}[pace]
    L = [f"# Music brief - {sc.get('title') or prj.cfg.get('output_name')}", "",
         f"- **Total duration: {total:.2f} s** (video {prj.cfg.get('fps', 60)} fps). Deliver a stereo WAV/MP3 of at least this length; it will be trimmed, faded in 0.5 s / out 2 s and loudness-normalised to -16 LUFS.",
         f"- Overall mood: {sc.get('mood', '')}", f"- Pace: {pace} (suggested tempo {bpm} BPM); visuals are a ballpoint pen drawing on notebook paper - intimate, handmade, light instrumentation (piano, acoustic guitar, glockenspiel, soft pads, light percussion). No vocals unless asked.",
         "- Hit points: page turns / erasers below are natural accents or phrase starts.",
         "", "| section | start (s) | end (s) | on-screen text | mood | starts with |", "|---|---|---|---|---|---|"]
    for p in pages:
        if p["kind"] == "title":
            L.append(f"| title card | {p['t0']:.2f} | {p['t1']:.2f} | {(p.get('title') or {}).get('text', '')} | intro | - |")
        elif p["kind"] == "end":
            L.append(f"| end card | {p['t0']:.2f} | {p['t1']:.2f} | {(p.get('text') or {}).get('text', '')} | outro / resolve | {p['enter']['type']} at {p['enter']['t0']:.2f} |")
        else:
            segs = p["segments"]
            for k, s in enumerate(segs):
                e = segs[k + 1]["t0"] if k + 1 < len(segs) else p["t1"]
                st = f"{p['enter']['type']} at {p['enter']['t0']:.2f}" if k == 0 else f"small eraser at {s['t0']:.2f}"
                L.append(f"| {s['page']} | {s['t0'] if k else p['t0']:.2f} | {e:.2f} | {' / '.join(s['text'])} | {s['mood']} | {st} |")
    L += ["", "## Add the music afterwards", "```", "python bpmv.py mux -p project.json --music path/to/music.wav [--offset 0.0]",
          "```", "Re-muxes the already rendered video (no re-render): music trimmed to the film, fades, -16 LUFS (+ pen foley if enabled)."]
    out = prj.p("work", "music_brief.md"); open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    return out

def run_script(prj, mode=None, text=None, file=None, title=None, author=None, force=False):
    cat = doodle_catalog()
    sp = prj.p(prj.cfg.get("script", "script.json"))
    if mode:
        if mode not in INPUT_MODES: die(f"--input must be one of {INPUT_MODES} (songs use lyric mode: python bpmv.py timeline)")
        src = text if text is not None else (open(file, encoding="utf-8").read() if file else None)
        if src is None: die("give the input with --text \"...\" or --file path.txt")
        open(prj.p("work", "source.txt"), "w", encoding="utf-8").write(src.strip() + "\n")
        json.dump({"input_mode": mode, "title": title, "author": author}, open(prj.p("work", "source.json"), "w", encoding="utf-8"), ensure_ascii=False)
        brief = write_brief(prj, mode, src, cat); print("brief:", brief)
        if os.path.exists(sp) and not force:
            print("script.json exists - keeping it (use --force to regenerate the skeleton)")
        else:
            if mode == "poem":
                ls = [l.strip() for l in src.splitlines() if l.strip()]
                sc = poem_script(ls, title, author, cat)
                print(f"poem: {len(ls)} lines kept verbatim -> {len(sc['pages'])} pages (review doodles/layouts in script.json)")
            else:
                sc = skeleton(mode, title)
                print("skeleton script.json written - AUTHOR IT following", brief, "then run: python bpmv.py script -p", prj.cfg_path)
            json.dump(sc, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if not os.path.exists(sp): die("script.json missing - run: python bpmv.py script --input theme|keywords|copy|poem|article ...")
    sc = json.load(open(sp, encoding="utf-8"))
    if "TODO" in json.dumps(sc, ensure_ascii=False):
        if mode: return None   # fresh skeleton: the agent writes it next
        die("script.json still has TODO markers - write the real copy/doodles first (references/script-examples.md)")
    err, warn = validate(sc, prj, cat)
    for w in warn: print("WARN", w)
    if err:
        if mode and any("TODO" in e for e in err): return None
        die("script.json invalid:\n  " + "\n  ".join(err))
    pages, lines, total = retime(sc, prj, cat)
    for p in pages: p.pop("seg", None)
    plan_doc = {"source": "script", "title": sc.get("title"), "duration": total, "pages": pages}
    json.dump(plan_doc, open(prj.p("work", "plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tl = {"source": "script", "song_duration": total, "lead_in": 0.0, "locked": False,
          "lines": lines, "notes": ["generated by bpmv.py script from script.json - edit script.json, not this file"]}
    json.dump(tl, open(prj.timeline_file, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mb = music_brief(prj, sc, pages, total)
    scn = prj.p(prj.cfg["scenes"])
    if not os.path.exists(scn):
        open(scn, "w", encoding="utf-8").write(open(os.path.join(SKILL_DIR, "templates", "scenes.auto.js"), encoding="utf-8").read())
        print("scenes.js created (autoBuild)")
    print(f"plan: {len(sc['pages'])} script pages -> {len(pages)} sheets incl. title/end, {len(lines)} text lines, {total:.1f} s")
    for p in pages:
        extra = p.get("layout", p["kind"])
        print(f"  {p['id']:<8} {p['t0']:6.2f}-{p['t1']:6.2f}  {extra:<12} {(p.get('enter') or {}).get('type', '')}")
    print("music brief:", mb)
    return plan_doc
