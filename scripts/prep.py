"""Stage 2: character illustration (transparent PNG) -> ballpoint stroke data  <project>/data/<name>.json (+ _preview.png)

  * line art  : dark thin lines -> skeleton -> traced polylines (greedy nearest-neighbour order, top to bottom, like a person drawing)
                + outer contour of big dark blobs (hair) split into short strokes + silhouette edges not covered by dark lines
  * hatching  : 4 blue layers by luminance (default angles 52/-38/8/95 deg, denser for darker), red pen layers for red/pink
                areas (mouth, blush), red for a small yellow hair clip inside hair
  * accents   : optional pattern detection (e.g. light/yellow motifs on coloured clothes) -> green-pen outlines
Coordinates are stored in sprite pixels; "sc" = display_height / image_height.
"""
import json, math, os, zlib
import numpy as np, cv2
from PIL import Image
from skimage.morphology import skeletonize

PREP_DEFAULTS = {
    "alpha_threshold": 128,
    "dark_v": 95,                 # HSV V below this = ink line / hair
    "blob_open": 11,              # opening kernel to find big dark blobs (hair)
    "contour_split_px": 260,      # split long outlines every N display px
    "min_line_px": 5,
    "layers": [                   # blue hatching layers: luminance threshold, angle (deg), spacing (display px)
        {"lum": 0.76, "ang": 52, "sp": 7.5},
        {"lum": 0.58, "ang": -38, "sp": 6.5},
        {"lum": 0.32, "ang": 8, "sp": 5.0},
        {"lum": 0.22, "ang": 95, "sp": 4.6},
    ],
    "red": {"enabled": True, "hue_lo": 12, "hue_hi": 165, "sat_min": 70},   # OpenCV hue 0..180; red = H<=lo or H>=hi
    "skin": {"hue": [5, 25], "sat": [45, 120], "val_min": 200},            # skin is left white (no hatching)
    "hairclip": {"enabled": True},  # yellow patch surrounded by hair -> red pen hatching + outline
    "accent": {"enabled": False, "base_hue": [30, 90], "base_sat_min": 30, "light_lum": 0.86, "light_sat_max": 60,
               "yellow_hue": [15, 35], "yellow_sat_min": 100, "yellow_val_min": 180},
}

def deep_merge(a, b):
    out = dict(a)
    for k, v in (b or {}).items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out

def trace(sk):
    sk = sk.copy().astype(bool); h, w = sk.shape
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    def nbs(y, x): return [(y + dy, x + dx) for dy, dx in nb if 0 <= y + dy < h and 0 <= x + dx < w and sk[y + dy, x + dx]]
    deg = {}; ys, xs = np.nonzero(sk)
    for y, x in zip(ys, xs): deg[(y, x)] = len(nbs(y, x))
    used = set(); paths = []
    def walk(a, b):
        p = [a, b]; used.add((a, b)); used.add((b, a)); prev, cur = a, b
        while deg.get(cur, 0) == 2:
            nx = [n for n in nbs(*cur) if n != prev and (cur, n) not in used]
            if not nx: break
            n = nx[0]; used.add((cur, n)); used.add((n, cur)); p.append(n); prev, cur = cur, n
        return p
    for node, d in deg.items():
        if d != 2:
            for n in nbs(*node):
                if (node, n) not in used: paths.append(walk(node, n))
    for node, d in deg.items():
        if d == 2:
            for n in nbs(*node):
                if (node, n) not in used: paths.append(walk(node, n))
    return paths

def simp(p, eps=.9):
    a = np.array([[x, y] for y, x in p], np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(a, eps, False).reshape(-1, 2).tolist()

def plen(p): return sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1))

def order(ls, start=None):
    ls = [l for l in ls if len(l) >= 2]; out = []
    if not ls: return []
    cur = start or min((p for l in ls for p in l), key=lambda p: p[1])
    while ls:
        best = None; bd = 1e18
        for i, l in enumerate(ls):
            for rev in (0, 1):
                p = l[-1] if rev else l[0]; d = (p[0] - cur[0]) ** 2 + (p[1] - cur[1]) ** 2 * 1.3
                if d < bd: bd = d; best = (i, rev)
        i, rev = best; l = ls.pop(i); l = l[::-1] if rev else l; out.append(l); cur = l[-1]
    return out

def contours(mask, amin, eps=.8):
    out = []; cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c) < amin: continue
        p = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).tolist(); p.append(p[0]); out.append(p)
    return out

def prep_sprite(src, name, display_h, out_dir, rel_src, cfg=None):
    P = deep_merge(PREP_DEFAULTS, cfg or {})
    im = np.asarray(Image.open(src).convert("RGBA")).astype(np.uint8)
    H0, W0 = im.shape[:2]; sc = float(display_h) / H0
    rgb = im[..., :3]; A = im[..., 3] > P["alpha_threshold"]
    if A.mean() > 0.97:
        print(f"WARNING {name}: image has (almost) no transparency - cut it out first (python bpmv.py cutout)")
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV); Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    lum = (.2126 * rgb[..., 0] + .7152 * rgb[..., 1] + .0722 * rgb[..., 2]) / 255.
    rng = np.random.default_rng(zlib.crc32(name.encode("utf-8")))   # deterministic per sprite name
    # ---- line art ----
    dark = (V < P["dark_v"]) & A
    k = P["blob_open"]
    blob = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
    thin = dark & ~cv2.dilate(blob.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    sil = cv2.morphologyEx(A.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    lines = [simp(p) for p in trace(skeletonize(thin))]
    lines = [l for l in lines if plen(l) >= P["min_line_px"] / sc]
    cs, _ = cv2.findContours(blob.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for c in cs:
        if cv2.contourArea(c) < 60: continue
        pts = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2).tolist(); pts.append(pts[0])
        n = max(1, int(plen(pts) * sc / P["contour_split_px"])); L = len(pts)   # a person doesn't draw a closed loop in one go
        for i in range(n): lines.append(pts[i * L // n:(i + 1) * L // n + 1])
    cs, _ = cv2.findContours(sil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cov = cv2.dilate(dark.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    for c in cs:   # silhouette edges only where no dark line exists
        c = c.reshape(-1, 2); run = []
        for x, y in c:
            if not cov[y, x]: run.append([int(x), int(y)])
            else:
                if len(run) > 12: lines.append(cv2.approxPolyDP(np.array(run, np.float32).reshape(-1, 1, 2), 1.0, False).reshape(-1, 2).tolist())
                run = []
        if len(run) > 12: lines.append(cv2.approxPolyDP(np.array(run, np.float32).reshape(-1, 1, 2), 1.0, False).reshape(-1, 2).tolist())
    lines = order(lines)
    # ---- colour groups ----
    R = P["red"]; SK = P["skin"]; AC = P["accent"]
    redish = (((Hh <= R["hue_lo"]) | (Hh >= R["hue_hi"])) & (S > R["sat_min"]) & A & ~dark) if R["enabled"] else np.zeros_like(A)
    skin = (Hh >= SK["hue"][0]) & (Hh <= SK["hue"][1]) & (S > SK["sat"][0]) & (S < SK["sat"][1]) & (V > SK["val_min"]) & A
    yellow = (Hh >= AC["yellow_hue"][0]) & (Hh <= AC["yellow_hue"][1]) & (S > AC["yellow_sat_min"]) & (V > AC["yellow_val_min"]) & A
    hd = cv2.dilate(blob.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    if AC["enabled"]:
        light = (lum > AC["light_lum"]) & (S < AC["light_sat_max"]) & A & ~skin
        base = (Hh >= AC["base_hue"][0]) & (Hh <= AC["base_hue"][1]) & (S > AC["base_sat_min"]) & A
        gd = cv2.dilate(base.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        accm = (light | yellow) & gd
    else:
        gd = np.zeros_like(A); accm = np.zeros_like(A)
    starm = (yellow & hd & ~gd) if P["hairclip"]["enabled"] else np.zeros_like(A)
    accm &= ~starm
    leaves = order(contours(cv2.morphologyEx(accm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)), 6 / sc ** 2))
    stars = contours(starm, 20)
    # ---- hatching ----
    def hatch(mask, ang, sp, maxlen=90, minlen=4):
        sp /= sc; mask = cv2.erode(mask.astype(np.uint8), np.ones((2, 2), np.uint8)) > 0
        ys, xs = np.nonzero(mask)
        if len(xs) == 0: return []
        a = math.radians(ang); d = np.array([math.cos(a), math.sin(a)]); nrm = np.array([-d[1], d[0]])
        pts = np.stack([xs, ys], 1); o = pts @ nrm; s = pts @ d
        segs = []; k = 0
        for off in np.arange(o.min(), o.max(), sp):
            k += 1; off2 = off + rng.normal(0, sp * .08)
            ss = np.arange(s.min() - 2, s.max() + 2, 1.0)
            Pp = ss[:, None] * d + off2 * nrm; xi = np.round(Pp[:, 0]).astype(int); yi = np.round(Pp[:, 1]).astype(int)
            ok = (xi >= 0) & (xi < W0) & (yi >= 0) & (yi < H0); m = np.zeros(len(ss), bool); m[ok] = mask[yi[ok], xi[ok]]
            idx = np.flatnonzero(np.diff(np.r_[0, m.astype(int), 0]))
            for i0, i1 in zip(idx[::2], idx[1::2]):
                L = (i1 - i0)
                if L * sc < minlen: continue
                n = max(1, int(math.ceil(L * sc / maxlen)))
                for j in range(n):
                    a0 = ss[i0] + L * j / n + rng.uniform(0, .8) / sc; a1 = ss[i0] + L * (j + 1) / n - rng.uniform(.6, 2.2) / sc
                    if (a1 - a0) * sc < minlen: continue
                    p0 = a0 * d + off2 * nrm; p1 = a1 * d + off2 * nrm
                    segs.append([[round(float(p0[0]), 1), round(float(p0[1]), 1)], [round(float(p1[0]), 1), round(float(p1[1]), 1)], k])
        return segs
    blue = A & ~redish & ~skin & ~accm & ~starm
    layers = [dict(c="b", segs=hatch(blue & (lum < Ly["lum"]), Ly["ang"], Ly["sp"])) for Ly in P["layers"]]
    # keep the original layer indexing: blue 0..3, red 4..5, hair-clip 6 (scenes pick layers by index)
    while len(layers) < 4: layers.append(dict(c="b", segs=[]))
    layers += [dict(c="r", segs=hatch(redish & (lum < .8), 60, 4.2, maxlen=40)), dict(c="r", segs=hatch(redish & (lum < .55), -30, 4.0, maxlen=40)),
               dict(c="r", segs=hatch(starm, 70, 3.4, maxlen=30))]
    for L in layers:   # sweep back and forth row by row like a real hand
        L["segs"].sort(key=lambda s: (s[2], s[0][0] + s[0][1]))
        for s in L["segs"]:
            if s[2] % 2: s[0], s[1] = s[1], s[0]
            del s[2]
    os.makedirs(out_dir, exist_ok=True)
    data = dict(name=name, src=rel_src.replace("\\", "/"), w=W0, h=H0, sc=sc, lines=[[[round(x, 1), round(y, 1)] for x, y in l] for l in lines],
                leaves=leaves, stars=stars, layers=layers)
    with open(os.path.join(out_dir, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"{name}: lines {len(lines)} ({int(sum(plen(l) for l in lines) * sc)} px), accents {len(leaves)}, hairclip {len(stars)}, hatch {[len(L['segs']) for L in layers]}")
    pv = np.full((H0, W0, 3), 245, np.uint8)
    for L in layers:
        col = (170, 60, 30) if L["c"] == "b" else (40, 40, 210)
        for s in L["segs"]: cv2.line(pv, tuple(map(int, s[0])), tuple(map(int, s[1])), col, 1)
    for l in lines: cv2.polylines(pv, [np.array(l, np.int32)], False, (120, 30, 10), 2)
    for l in leaves: cv2.polylines(pv, [np.array(l, np.int32)], False, (60, 140, 60), 2)
    for l in stars: cv2.polylines(pv, [np.array(l, np.int32)], False, (40, 40, 210), 2)
    cv2.imwrite(os.path.join(out_dir, name + "_preview.png"), pv)
    return data

def prep_project(prj, names=None):
    c = prj.cfg; sprites = c.get("sprites") or {}
    if not sprites:
        raise SystemExit('project.json "sprites" is empty: add {"name": {"height": 420}, ...}')
    for name, sc in sprites.items():
        if names and name not in names: continue
        rel = os.path.join(c["sprites_dir"], sc.get("file") or (name + ".png"))
        src = prj.p(rel)
        if not os.path.exists(src): raise SystemExit(f"sprite not found: {src}\n  This package ships NO character images. Put your own PNG there (or generate one with the prompt in SKILL.md section 5).")
        prep_sprite(src, name, sc["height"], prj.p("data"), os.path.relpath(src, prj.dir), deep_merge(c.get("prep") or {}, sc.get("prep") or {}))
