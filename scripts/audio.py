"""Sound: procedural pen foley + audio track assembly for every music mode.

music.mode
  song      lyric-sync mode: the song (delayed by lead_in), as before
  none      silent film (a silent AAC track is still written for player compatibility); + foley if foley.enabled
  external  a music file added later (`bpmv.py mux --music x.wav`): offset, trim to the film, fade in/out, loudness -16 LUFS;
            + foley underneath if foley.enabled
Foley (procedural, no samples): pen scratching follows the real pen-down/speed curve of the film (engine `penlog`),
page flips = paper swoosh + soft thump, page eraser = rhythmic rubbing, small eraser = short quiet rubbing.
"""
import json, os, subprocess
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf
from common import ffmpeg, node, run, die

SR = 44100

def _bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)

def _lp(x, hi, order=2):
    return sosfilt(butter(order, hi, btype="low", fs=SR, output="sos"), x)

def foley(prj, mv_js, out=None):
    log = prj.p("work", "penlog.json")
    r = subprocess.run([node(), mv_js, "penlog", log], capture_output=True, text=True)
    if r.returncode: die("penlog failed:\n" + r.stderr[-1500:])
    L = json.load(open(log)); dur = L["duration"]; n = int(dur * SR) + SR // 10
    rng = np.random.default_rng(7); y = np.zeros(n)
    # pen scratch: band-limited noise x pen-down x speed, with paper-grain flutter
    S = np.array(L["samples"], dtype=float); fps = L["fps"]
    tt = np.arange(len(S)) / fps
    down = np.interp(np.arange(n) / SR, tt, S[:, 0]); spd = np.interp(np.arange(n) / SR, tt, np.clip(S[:, 1] / 700.0, 0, 1.4))
    env = _lp(down * (0.25 + 0.75 * np.minimum(spd, 1.0)), 30)
    grain = 0.55 + 0.45 * np.abs(_lp(rng.standard_normal(n), 35)) / 0.05
    grain = np.clip(grain / np.percentile(grain, 95), 0, 1.2)
    scratch = _bp(rng.standard_normal(n), 1800, 7500) * 0.6 + _bp(rng.standard_normal(n), 500, 1800) * 0.25
    y += scratch * env * grain * 0.22
    def seg(t0, t1):
        a, b = int(t0 * SR), min(n, int(t1 * SR)); return a, b
    for tr in L["transitions"]:
        a, b = seg(tr["t0"], tr["t1"]); m = b - a
        if m <= 0: continue
        u = np.linspace(0, 1, m)
        if tr["type"] == "flip":
            sw = _bp(rng.standard_normal(m), 300, 4000) * np.sin(np.pi * u) ** 1.5 * 0.35
            th_len = min(m, int(0.07 * SR)); th = _lp(rng.standard_normal(th_len), 220) * np.exp(-np.linspace(0, 6, th_len)) * 1.6
            y[a:b] += sw; y[b - th_len:b] += th
        else:
            rub = _bp(rng.standard_normal(m), 250, 2200) * (0.35 + 0.65 * np.abs(np.sin(np.pi * 2.6 * u * (m / SR)))) * 0.3
            y[a:b] += rub * np.minimum(1, np.minimum(u, 1 - u) * 12)
    for e0, e1 in L["small_erase"]:
        a, b = seg(e0, e1); m = b - a
        if m > 0:
            u = np.linspace(0, 1, m)
            y[a:b] += _bp(rng.standard_normal(m), 400, 2500) * (0.4 + 0.6 * np.abs(np.sin(np.pi * 3.2 * u * (m / SR)))) * 0.18 * np.minimum(1, np.minimum(u, 1 - u) * 10)
    lvl = prj.cfg.get("foley", {}).get("level_db", -24)
    rms = np.sqrt(np.mean(y[np.abs(y) > 1e-4] ** 2)) if np.any(np.abs(y) > 1e-4) else 1
    y = y / max(rms, 1e-9) * 10 ** (lvl / 20)
    y = np.clip(y, -0.9, 0.9)
    st = np.stack([y, y * 0.92], 1)   # slightly off-centre stereo
    out = out or prj.p("work", "foley.wav"); sf.write(out, st, SR)
    print(f"foley: {out} ({dur:.1f}s, level {lvl} dB RMS)")
    return out

def _loudnorm(src, out, I=-16.0, TP=-2.0, LRA=11):
    """two-pass EBU R128 normalisation (linear when possible). TP -2.0 here keeps the final AAC <= -1.5 dBTP."""
    import re
    r = subprocess.run([ffmpeg(), "-hide_banner", "-nostats", "-i", src, "-af", f"loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    af = (f"loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample={SR}")
    run([ffmpeg(), "-v", "error", "-y", "-i", src, "-af", af, "-ar", str(SR), out])

def build_audio(prj, mv_js, music_file=None, offset=None):
    """full-length audio track for script/none/external/auto modes -> work/audio_mix.wav (song mode is handled by render.mux)"""
    c = prj.cfg; dur = prj.duration(); m = dict(c.get("music") or {})
    if music_file: m["mode"], m["file"] = "external", music_file
    if offset is not None: m["offset"] = offset
    fol = foley(prj, mv_js) if c.get("foley", {}).get("enabled") else None
    out = prj.p("work", "audio_mix.wav")
    mf = None
    if m.get("mode") == "auto":
        from music import auto_music
        mf = auto_music(prj); m.setdefault("offset", 0)
    elif m.get("mode") == "external" and m.get("file"):
        mf = m["file"] if os.path.isabs(m["file"]) else (os.path.abspath(m["file"]) if os.path.exists(m["file"]) else prj.p(m["file"]))
        if not os.path.exists(mf): die("music file not found: " + mf)
    if mf:
        off = float(m.get("offset") or 0); fi = float(m.get("fade_in", .5)); fo = float(m.get("fade_out", 2.0)); lufs = float(m.get("lufs", -16))
        pre = f"atrim=start={max(0, -off):.3f},asetpts=PTS-STARTPTS," + (f"adelay={int(off*1000)}|{int(off*1000)}," if off > 0 else "")
        mus = (f"[0:a]{pre}aformat=sample_rates={SR}:channel_layouts=stereo,apad,atrim=end={dur:.3f},"
               f"afade=t=in:st=0:d={fi:.2f},afade=t=out:st={max(0, dur-fo):.3f}:d={fo:.2f}[m]")
        raw = prj.p("work", "audio_premix.wav")
        if fol:   # foley sits ~14 dB under the music, then the MIX is normalised
            fc = mus + f";[m]loudnorm=I={lufs}:TP=-2:LRA=11[mn];[1:a]aformat=sample_rates={SR}:channel_layouts=stereo,apad,atrim=end={dur:.3f},volume=1.0[f];[mn][f]amix=inputs=2:normalize=0:duration=first[o]"
            run([ffmpeg(), "-v", "error", "-y", "-i", mf, "-i", fol, "-filter_complex", fc, "-map", "[o]", "-ar", str(SR), raw])
        else:
            run([ffmpeg(), "-v", "error", "-y", "-i", mf, "-filter_complex", mus, "-map", "[m]", "-ar", str(SR), raw])
        _loudnorm(raw, out, I=lufs, TP=-2.0)
    elif fol:
        run([ffmpeg(), "-v", "error", "-y", "-i", fol, "-af", f"apad,atrim=end={dur:.3f}", "-ar", str(SR), out])
    else:
        run([ffmpeg(), "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=stereo", "-t", f"{dur:.3f}", out])
    return out

def loudness(path):
    """(integrated LUFS, true peak dBTP)"""
    import re
    r = subprocess.run([ffmpeg(), "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr); p = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", r.stderr)
    return (float(i[-1]) if i else None, float(p[-1]) if p and p[-1] != "-inf" else None)
