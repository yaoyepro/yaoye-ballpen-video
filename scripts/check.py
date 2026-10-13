"""Stage 6: self-check.
  A) scene-plan checks (node build/mv.js selfcheck): lyric overlap, lyric/sprite/anim out of frame, pen in logo,
     every timeline line written exactly once and on time, pen-task overlaps.
  B) video checks (if a rendered video is given): 1-fps overview contact sheets, black/blank frames,
     pixel-oscillation statistics per second (info; jittery animation itself is caught by plan check animFast).
Writes <project>/out/check/report.json + report.md and prints a PASS/WARN summary."""
import json, os, subprocess
import numpy as np
from common import ffmpeg, node, run, probe_duration

def plan_checks(prj, mv_js):
    r = subprocess.run([node(), mv_js, "selfcheck"], capture_output=True, text=True)
    if r.returncode: raise SystemExit("selfcheck failed:\n" + r.stderr[-2000:])
    return json.loads(r.stdout.strip().splitlines()[-1])

def contact_sheets(video, out_dir, cols=6, rows=5):
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.startswith("overview_"): os.remove(os.path.join(out_dir, f))
    run([ffmpeg(), "-v", "error", "-y", "-i", video, "-vf", f"fps=1,scale=384:216,drawtext=text='%{{pts\\:hms}}':x=6:y=6:fontsize=16:fontcolor=red:box=1:boxcolor=white@0.6,tile={cols}x{rows}:padding=4:color=white",
         "-vsync", "vfr", os.path.join(out_dir, "overview_%02d.png")])
    return sorted(os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.startswith("overview_"))

def contact_sheets_safe(video, out_dir):
    try:
        return contact_sheets(video, out_dir)
    except SystemExit:   # ffmpeg without drawtext/fontconfig (common on Windows builds) -> no timestamps
        run([ffmpeg(), "-v", "error", "-y", "-i", video, "-vf", "fps=1,scale=384:216,tile=6x5:padding=4:color=white", "-vsync", "vfr", os.path.join(out_dir, "overview_%02d.png")])
        return sorted(os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.startswith("overview_"))

def video_stats(video, w=480, h=270, fps=30):
    p = subprocess.Popen([ffmpeg(), "-v", "error", "-i", video, "-vf", f"fps={fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    lum, osc, buf = [], [], []
    while True:
        b = p.stdout.read(w * h)
        if len(b) < w * h: break
        a = np.frombuffer(b, np.uint8).astype(np.int16); lum.append(float(a.mean())); buf.append(a)
        if len(buf) == fps + 1:   # 1-second window: pixels flipping brighter/darker >= 6 times
            d = np.diff(np.stack(buf), axis=0); sg = np.where(d > 14, 1, np.where(d < -14, -1, 0))
            last = np.zeros(w * h, np.int8); cnt = np.zeros(w * h, np.int16)
            for s in sg:
                m = s != 0; cnt += m & (last != 0) & (s != last); last = np.where(m, s, last)
            osc.append(float((cnt >= 6).mean())); buf = [buf[-1]]
    p.wait()
    lum = np.array(lum); osc = np.array(osc) if osc else np.zeros(1)
    return {"frames": len(lum), "black_frames": int((lum < 20).sum()), "mean_luma": round(float(lum.mean()), 1) if len(lum) else 0,
            "flicker_mean_pct": round(100 * float(osc.mean()), 4), "flicker_max_pct": round(100 * float(osc.max()), 4),
            "flicker_seconds_over_0.05pct": [int(i) for i in np.flatnonzero(osc > .0005)]}

def check(prj, mv_js, video=None):
    out_dir = prj.p("out", "check"); os.makedirs(out_dir, exist_ok=True)
    rep = {"plan": plan_checks(prj, mv_js)}
    P = rep["plan"]; issues = []
    for k, label in [("lyricOverlap", "ink on top of lyrics"), ("lyricOut", "lyric outside frame / on logo"), ("animOut", "moving group leaves frame"),
                     ("animLogo", "moving group touches logo"), ("animLyric", "moving sprite crosses a lyric"), ("spriteOut", "sprite outside frame"),
                     ("lyricsMissing", "timeline lines never written"), ("lyricsDuplicated", "lyric line written twice"),
                     ("lyricsLate", "lyric written far from when it is sung"), ("penInLogo", "pen enters logo box"), ("animFast", "motion reverses >3 Hz (jittery)"), ("buildWarnings", "pen timing warnings"),
                     ("elemOnSprite", "element drawn over a character")]:
        v = P.get(k) or []
        if v: issues.append(f"{label}: {len(v)} -> {json.dumps(v[:6], ensure_ascii=False)}")
    if video:
        rep["video"] = video_stats(video); rep["video"]["duration"] = probe_duration(video)
        rep["overviews"] = contact_sheets_safe(video, out_dir)
        V = rep["video"]
        if V["black_frames"]: issues.append(f"black frames: {V['black_frames']}")
        # info only: the moving pen itself (hatching back and forth) produces pixel oscillation; compare against earlier renders,
        # look at the listed seconds in the overview sheets. Jittery ANIMATION is caught by plan check "animFast".
        rep["video"]["flicker_note"] = "pen motion inflates this metric; investigate only seconds far above the rest"
    rep["issues"] = issues
    json.dump(rep, open(os.path.join(out_dir, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write("# Self-check\n\n" + ("PASS - no issues\n" if not issues else "\n".join("- WARN " + i for i in issues) + "\n"))
        if rep.get("overviews"): f.write("\nOverview sheets (1 frame/s): " + ", ".join(os.path.basename(p) for p in rep["overviews"]) + "\n")
    print("SELF-CHECK:", "PASS" if not issues else f"{len(issues)} warning group(s)")
    for i in issues: print("  WARN", i)
    if rep.get("overviews"): print("  overview sheets:", *rep["overviews"], sep="\n    ")
    return rep
