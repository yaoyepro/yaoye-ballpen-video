#!/usr/bin/env python3
"""yaoye-ballpen-video - hand-drawn ballpoint-pen films from a song, theme, keywords, poem or article. One entry point for every stage (Linux / macOS / Windows).

  python bpmv.py setup [--audio]                npm install + pip install -r requirements.txt (+ song-mode ASR), then doctor
  python bpmv.py doctor                         check node / skia-canvas / ffmpeg / python deps / GPU
  python bpmv.py init  <project_dir>            new project skeleton from templates/
  python bpmv.py cutout --src raw --dst sprites [-p ...]   white-background images -> transparent PNGs (optional)
  python bpmv.py script --input theme|keywords|copy|poem|article (--text "..."|--file f) [--title T --author A]
                                                stage 1 (SCRIPT mode, no song): brief + script.json; run `script` again to plan timings
  python bpmv.py timeline [--force]             stage 1 (SONG mode): audio (+lyrics) -> work/timeline.json (+ timeline_review.md)
  python bpmv.py prep [name ...]                stage 2: sprites -> data/<name>.json ballpoint stroke data (+ _preview.png)
  python bpmv.py build                          stage 3: assemble build/mv.js from scenes.js, print timing warnings + lyric placement
  python bpmv.py stills -t 2.5,8,14             quick PNG frames from the scene plan (no video) -> out/stills/
  python bpmv.py sample [--seconds 25]          stage 4: render the first N s + mux + 3 stills  ==> STOP, get user approval
  python bpmv.py render [--fps 60]              stage 5: full chunked/resumable render + mux (main 1080p + phone 720p30)
  python bpmv.py check [--video out/x.mp4]      stage 6: self-check report (+ video checks, overview sheets)
  python bpmv.py foley                          synthesize pen/page/eraser sounds -> work/foley.wav (also automatic if foley.enabled)
  python bpmv.py mux --music m.wav [--offset s] add music to an already rendered film (no re-render): trim, fades, -16 LUFS
  python bpmv.py music                          compose the AUTO backing track now (work/music_auto.wav + .mid) to listen first

All commands take -p/--project PATH (default: ./project.json)."""
import argparse, json, os, shutil, subprocess, sys
for _s in (sys.stdout, sys.stderr):   # Windows consoles (cp936/cp1252) choke on some lyric characters
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "scripts"))
from common import Project, SKILL_DIR, node, ffmpeg, die, run   # noqa: E402

def cmd_doctor(a):
    ok = True
    def rep(name, good, info=""):
        nonlocal ok; ok &= bool(good); print(f"[{'OK' if good else '!!'}] {name} {info}")
    import platform; print("platform:", platform.platform(), "python", sys.version.split()[0])
    nb = shutil.which("node"); rep("node", nb, subprocess.run([nb, "-v"], capture_output=True, text=True).stdout.strip() if nb else "-> install Node.js >= 18")
    if nb:
        r = subprocess.run([nb, "-e", "require('skia-canvas');const p=require('path'),f=require('fs');let d=p.dirname(require.resolve('skia-canvas'));while(!f.existsSync(p.join(d,'package.json')))d=p.dirname(d);console.log(JSON.parse(f.readFileSync(p.join(d,'package.json'))).version)"], cwd=SKILL_DIR, capture_output=True, text=True)
        rep("skia-canvas", r.returncode == 0, r.stdout.strip() or "-> run: npm install   (in " + SKILL_DIR + ")")
    fb = shutil.which("ffmpeg"); rep("ffmpeg", fb, fb or "-> Windows: winget install Gyan.FFmpeg ; Debian/Ubuntu: apt install ffmpeg")
    for m in ["numpy", "cv2", "skimage", "PIL", "scipy", "soundfile", "librosa"]:
        try: __import__(m); rep("python " + m, True)
        except Exception as e: rep("python " + m, False, f"-> pip install -r requirements.txt ({e})")
    for m in ["faster_whisper", "demucs"]:   # optional: only SONG mode (lyric timing) needs them
        try: __import__(m); print(f"[OK] python {m} (song mode)")
        except Exception: print(f"[--] python {m} not installed - only needed for SONG mode: setup --audio")
    try: __import__("fontTools"); print("[OK] python fontTools (glyph check)")
    except Exception: print("[--] fontTools missing - glyph check skipped (pip install fonttools)")
    try:
        import ctranslate2; n = ctranslate2.get_cuda_device_count(); print(f"[..] CUDA devices for faster-whisper: {n} ({'GPU' if n else 'CPU int8 - large-v3 takes ~1-2x song length'})")
    except Exception: pass
    try:
        import torch; print(f"[..] torch {torch.__version__} cuda={torch.cuda.is_available()} (demucs; CPU works, ~1-3 min per song)")
    except Exception: pass
    f = os.path.join(SKILL_DIR, "fonts", "Yozai-Regular.ttf"); rep("default font Yozai", os.path.exists(f), "" if os.path.exists(f) else "-> python scripts/fetch_fonts.py")
    print("ALL GOOD" if ok else "fix the !! items above")

def cmd_setup(a):
    """install the Node + Python packages this skill needs (not system tools: Node.js, Python, ffmpeg)"""
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm: die("npm not found - install Node.js >= 18 first (https://nodejs.org), then re-run setup")
    print("$ npm install"); r = subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=SKILL_DIR)
    if r.returncode: die("npm install failed - behind a proxy? set HTTPS_PROXY and retry (see references/troubleshooting.md)")
    reqs = ["requirements.txt"] + (["requirements-audio.txt"] if a.audio else [])
    for q in reqs:
        print(f"$ {sys.executable} -m pip install -r {q}")
        cmd = [sys.executable, "-m", "pip", "install", "-r", os.path.join(SKILL_DIR, q)]
        r = subprocess.run(cmd, capture_output=True, text=True); print(r.stdout[-1500:], r.stderr[-1500:])
        if r.returncode and "externally-managed" in (r.stdout + r.stderr):
            # PEP 668 (Homebrew Python on macOS, Debian/Ubuntu system Python): install into the user site instead
            print("system Python is externally managed -> retrying with --user --break-system-packages (user site only)")
            r = subprocess.run(cmd + ["--user", "--break-system-packages"])
        if r.returncode: die(f"pip install -r {q} failed (see references/troubleshooting.md section 1)")
    cmd_doctor(a)

def cmd_init(a):
    d = os.path.abspath(a.dir)
    if os.path.exists(os.path.join(d, "project.json")): die("project.json already exists in " + d)
    for s in ("audio", "sprites", "logo"): os.makedirs(os.path.join(d, s), exist_ok=True)
    T = lambda f: os.path.join(SKILL_DIR, "templates", f)
    if a.mode == "song":
        shutil.copy(T("project.template.json"), os.path.join(d, "project.json"))
        shutil.copy(T("scenes.template.js"), os.path.join(d, "scenes.js"))
        shutil.copy(T("lyrics.template.txt"), os.path.join(d, "lyrics.txt"))
        print("new SONG project in", d, "\n  put the song in audio/, character PNGs in sprites/, edit project.json + lyrics.txt, then: python bpmv.py timeline -p", os.path.join(d, "project.json"))
    else:
        shutil.copy(T("project.script.template.json"), os.path.join(d, "project.json"))
        shutil.copy(T("scenes.auto.js"), os.path.join(d, "scenes.js"))
        print("new SCRIPT project in", d, "\n  next: python bpmv.py script --input theme|keywords|copy|poem|article --text \"...\" -p", os.path.join(d, "project.json"))

def prj_of(a): return Project(a.project)

def assemble(prj):
    from assemble import assemble as asm
    return asm(prj)

def build_report(mv):
    r = subprocess.run([node(), mv, "info"], capture_output=True, text=True)
    if r.returncode: die("scene build failed:\n" + r.stderr[-3000:])
    info = json.loads(r.stdout)
    print(f"duration {info['duration']}s, {len(info['pages'])} pages, {len(info['transitions'])} transitions")
    for L in info["lyrics"]:
        pl = ", ".join(f"{p['page']}@{p['ts']}" for p in L["placed"]) or ("(skip)" if L["skip"] else "NOT PLACED")
        print(f"  L{L['i']:<3} sung {L['sung']:7.2f}  {pl:24s} {L['text']}")
    print("warnings:", *(info["warnings"] or ["none"]), sep="\n  ")
    return info

def cmd_timeline(a):
    from timeline import build_timeline
    build_timeline(prj_of(a), force=a.force)

def cmd_script(a):
    from script import run_script
    prj = prj_of(a)
    if prj.cfg["mode"] != "script": die("project is in SONG mode (it has \"audio\"); script mode needs a project without audio (python bpmv.py init DIR --mode script)")
    run_script(prj, a.input, a.text, a.file, a.title, a.author, a.force)

def prepare_audio(prj, mv, music=None, offset=None):
    if (prj.cfg.get("music") or {}).get("mode", "song") != "song" or music:
        from audio import build_audio
        return build_audio(prj, mv, music, offset)

def cmd_foley(a):
    from audio import foley
    prj = prj_of(a); mv, h = assemble(prj); foley(prj, mv)

def cmd_mux(a):
    from render import mux
    from audio import loudness
    prj = prj_of(a); mv, h = assemble(prj); fps = a.fps or prj.cfg["fps"]; dur = prj.duration()
    vid = prj.p("work", f"video_full_{fps}.mp4")
    if a.video: vid = os.path.abspath(a.video) if os.path.exists(a.video) else prj.p(a.video)
    if not os.path.exists(vid): die(f"no rendered video track {vid} - run `bpmv.py render` first (or pass --video)")
    if prj.cfg["mode"] == "song" and not a.music: die("song mode already muxes the song; pass --music to replace it")
    if a.music: prj.cfg["music"] = dict(prj.cfg.get("music") or {}, mode="external", file=a.music)
    prepare_audio(prj, mv, a.music, a.offset)
    name = prj.cfg["output_name"]
    main, phone = mux(prj, vid, 0, dur, fps, f"{name}_1080p{fps}.mp4", f"{name}_phone_720p{prj.cfg.get('phone_fps',30)}.mp4")
    I, tp = loudness(main); print(f"loudness: {I} LUFS integrated, true peak {tp} dBTP")

def cmd_music(a):
    from music import auto_music
    auto_music(prj_of(a))

def cmd_cutout(a):
    from cutout import cutout_dir
    prj = prj_of(a); cutout_dir(prj.p(a.src), prj.p(a.dst))

def cmd_prep(a):
    from prep import prep_project
    prep_project(prj_of(a), a.names or None)

def cmd_build(a):
    prj = prj_of(a); mv, h = assemble(prj); build_report(mv)

def cmd_stills(a):
    prj = prj_of(a); mv, h = assemble(prj); out = prj.p("out", "stills")
    run([node(), mv, "png", out, a.times]); print("stills in", out)

def cmd_sample(a):
    from render import render_video, mux, stills
    prj = prj_of(a); mv, h = assemble(prj); build_report(mv)
    secs = min(a.seconds or prj.cfg["sample_seconds"], prj.duration()); fps = a.fps or prj.cfg["fps"]
    vid = render_video(prj, mv, h, 0, secs, fps, "sample", a.workers)
    prepare_audio(prj, mv)
    name = prj.cfg["output_name"]
    main, phone = mux(prj, vid, 0, secs, fps, f"{name}_sample_1080p{fps}.mp4", f"{name}_sample_phone_720p{prj.cfg.get('phone_fps',30)}.mp4")
    st = stills(prj, main, [round(secs * k, 2) for k in (.18, .5, .85)], prj.p("out", "sample_frames"))
    print("\nSAMPLE READY. Show the user the sample video + frames and WAIT for approval before `bpmv.py render`.")
    print(*st, sep="\n")

def cmd_render(a):
    from render import render_video, mux
    prj = prj_of(a); mv, h = assemble(prj); info = build_report(mv)
    if info["warnings"] and not a.ignore_warnings: die("fix the scene warnings above first (or pass --ignore-warnings)")
    fps = a.fps or prj.cfg["fps"]; dur = prj.duration()
    vid = render_video(prj, mv, h, 0, dur, fps, "full", a.workers)
    prepare_audio(prj, mv)
    name = prj.cfg["output_name"]
    mux(prj, vid, 0, dur, fps, f"{name}_1080p{fps}.mp4", f"{name}_phone_720p{prj.cfg.get('phone_fps',30)}.mp4")
    print("next: python bpmv.py check --video", os.path.join("out", f"{name}_1080p{fps}.mp4"))

def cmd_check(a):
    from check import check
    prj = prj_of(a); mv, h = assemble(prj)
    v = (os.path.abspath(a.video) if os.path.exists(a.video) else prj.p(a.video)) if a.video else None  # cwd-relative, else project-relative
    check(prj, mv, v)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    def sp(name, fn, **kw):
        p = sub.add_parser(name, **kw); p.set_defaults(fn=fn)
        if name not in ("doctor", "init"): p.add_argument("-p", "--project", default="project.json")
        return p
    sp("doctor", cmd_doctor)
    p = sp("setup", cmd_setup); p.add_argument("--audio", action="store_true", help="also install the song-mode ASR packages")
    p = sp("init", cmd_init); p.add_argument("dir"); p.add_argument("--mode", choices=["song", "script"], default="script")
    p = sp("script", cmd_script); p.add_argument("--input", choices=["theme", "keywords", "copy", "poem", "article"]); p.add_argument("--text"); p.add_argument("--file")
    p.add_argument("--title"); p.add_argument("--author"); p.add_argument("--force", action="store_true")
    p = sp("foley", cmd_foley)
    p = sp("music", cmd_music)
    p = sp("mux", cmd_mux); p.add_argument("--music"); p.add_argument("--offset", type=float); p.add_argument("--video"); p.add_argument("--fps", type=int)
    p = sp("cutout", cmd_cutout); p.add_argument("--src", required=True); p.add_argument("--dst", default="sprites")
    p = sp("timeline", cmd_timeline); p.add_argument("--force", action="store_true")
    p = sp("prep", cmd_prep); p.add_argument("names", nargs="*")
    sp("build", cmd_build)
    p = sp("stills", cmd_stills); p.add_argument("-t", "--times", required=True)
    p = sp("sample", cmd_sample); p.add_argument("--seconds", type=float); p.add_argument("--fps", type=int); p.add_argument("--workers", type=int, default=0)
    p = sp("render", cmd_render); p.add_argument("--fps", type=int); p.add_argument("--workers", type=int, default=0); p.add_argument("--ignore-warnings", action="store_true")
    p = sp("check", cmd_check); p.add_argument("--video")
    a = ap.parse_args(); a.fn(a)

if __name__ == "__main__":
    main()
