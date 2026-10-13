"""Stages 4/5: chunked, resumable, parallel render of build/mv.js + audio mux.
Chunks live in <project>/chunks/<tag>_<fps>/c_<frame>.mp4 and are reused only while build/mv.hash is unchanged
(any edit to scenes/config/timeline/sprite data invalidates them automatically)."""
import os, shutil, subprocess, time, json
from concurrent.futures import ThreadPoolExecutor
from common import ffmpeg, node, run, die

def render_video(prj, mv_js, build_hash, t0, t1, fps, tag, workers=0):
    c = prj.cfg["render"]
    D = prj.p("chunks", f"{tag}_{fps}")
    os.makedirs(D, exist_ok=True)
    hf = os.path.join(D, "build.hash")
    if os.path.exists(hf) and open(hf).read().strip() != build_hash:
        print("build changed since last render -> clearing stale chunks", D)
        shutil.rmtree(D); os.makedirs(D)
    open(hf, "w").write(build_hash)
    F0, F1 = int(round(t0 * fps)), int(round(t1 * fps)); step = int(round(c.get("chunk_seconds", 3) * fps))
    jobs = [(f, min(f + step, F1)) for f in range(F0, F1, step)]
    todo = [j for j in jobs if not os.path.exists(os.path.join(D, f"c_{j[0]:07d}.mp4"))]
    nw = workers or c.get("workers") or max(1, min(8, (os.cpu_count() or 2) - 1))
    print(f"render {tag}: {t0:.2f}-{t1:.2f}s @{fps}fps, {len(jobs)} chunks, {len(todo)} to do, {nw} workers", flush=True)
    st = time.time(); done = [0]; fails = []
    nodebin = node(); env = dict(os.environ, FFMPEG=ffmpeg())
    def one(j):
        out = os.path.join(D, f"c_{j[0]:07d}.mp4")
        r = subprocess.run([nodebin, mv_js, "chunk", out, str(j[0]), str(j[1]), str(fps)], capture_output=True, text=True, env=env)
        done[0] += 1
        if r.returncode: fails.append(j); print("FAIL", j, r.stderr[-800:], flush=True)
        else: print(f"  {done[0]}/{len(todo)} chunk {j[0]/fps:.1f}s ok ({time.time()-st:.0f}s)", flush=True)
    with ThreadPoolExecutor(nw) as ex: list(ex.map(one, todo))
    if fails: die(f"{len(fails)} chunks failed - fix and re-run (finished chunks are kept)")
    lst = os.path.join(D, "list.txt")
    with open(lst, "w") as f: f.write("".join(f"file 'c_{a:07d}.mp4'\n" for a, b in jobs))
    vid = prj.p("work", f"video_{tag}_{fps}.mp4")
    run([ffmpeg(), "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vid])
    print(f"video track {vid} ({time.time()-st:.0f}s)")
    return vid

def mux(prj, video, t0, t1, fps, name_main, name_phone):
    """music = lead_in silence + song, cut to [t0,t1], faded at the very end of the full MV."""
    c = prj.cfg; lead = float(c["lead_in"]); dur = prj.duration(); fo = float(c.get("audio_fade_out") or 0)
    if (c.get("music") or {}).get("mode", "song") == "song":
        song = prj.p("work", "song.wav") if os.path.exists(prj.p("work", "song.wav")) else prj.p(c["audio"])
        ms = int(round(lead * 1000))
    else:   # none / external (+foley): full-length track prepared by scripts/audio.py build_audio
        song = prj.p("work", "audio_mix.wav"); ms = 0
        if not os.path.exists(song): die("work/audio_mix.wav missing (bpmv.py builds it before muxing)")
    af = (f"adelay={ms}|{ms}," if ms else "") + f"apad,atrim=start={t0:.3f}:end={t1:.3f},asetpts=PTS-STARTPTS"
    if fo > 0 and t1 >= dur - 0.01:
        af += f",afade=t=out:st={max(0, dur - fo - t0):.3f}:d={fo:.3f}"
    if t1 < dur - 0.01:   # sample cut: short fade so it does not end abruptly
        af += f",afade=t=out:st={max(0, t1 - t0 - 0.6):.3f}:d=0.6"
    rc = c["render"]; outd = prj.p("out"); os.makedirs(outd, exist_ok=True)
    main = os.path.join(outd, name_main); phone = os.path.join(outd, name_phone)
    run([ffmpeg(), "-v", "error", "-y", "-i", video, "-i", song, "-filter:a", af, "-map", "0:v", "-map", "1:a",
         "-c:v", "libx264", "-preset", "medium", "-crf", str(rc.get("main_crf", 18)), "-pix_fmt", "yuv420p", "-r", str(fps),
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", main])
    pf = c.get("phone_fps", 30)
    run([ffmpeg(), "-v", "error", "-y", "-i", main, "-vf", f"scale=1280:720:flags=lanczos,fps={pf}",
         "-c:v", "libx264", "-preset", "medium", "-crf", str(rc.get("phone_crf", 23)), "-pix_fmt", "yuv420p", "-profile:v", "high",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", phone])
    for p in (main, phone): print(f"OUT {p}  {os.path.getsize(p)/1e6:.1f} MB")
    return main, phone

def stills(prj, video, times, out_dir):
    os.makedirs(out_dir, exist_ok=True); res = []
    for t in times:
        p = os.path.join(out_dir, f"frame_{t:07.2f}s.png")
        run([ffmpeg(), "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", p]); res.append(p)
    return res
