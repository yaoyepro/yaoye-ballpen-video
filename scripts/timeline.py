"""Stage 1: audio -> work/timeline.json
  1. ffmpeg -> work/song.wav
  2. demucs vocal separation -> work/sep/<model>/song/vocals.wav      (skip with asr.demucs=false)
  3. faster-whisper word timestamps on the vocals -> work/asr.json     (prompted with the lyrics if given)
  4. librosa beats/onsets/energy -> work/beats.json
  5. align lyrics.txt lines to ASR tokens (CJK per character, latin per word) -> work/timeline.json + work/timeline_review.md
Every step is cached; delete the file (or pass --force) to recompute.
YOU MUST REVIEW timeline_review.md: low-confidence lines are estimates. Edit work/timeline.json by hand if needed
(song_start/song_end in SONG time; set "skip": true for lines that are not sung)."""
import difflib, json, os, re, subprocess, sys
from common import ffmpeg, run, die

CJK = r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]"
TOK = re.compile(CJK + r"|[A-Za-z0-9']+")
SECTION = re.compile(r"^\s*[\[【(（].*[\]】)）]\s*$")

def toks(s): return [t.lower() for t in TOK.findall(s)]

def read_lyrics(path):
    lines, section = [], ""
    for raw in open(path, encoding="utf-8-sig"):
        s = raw.strip()
        if not s: continue
        if SECTION.match(s): section = s.strip("[]【】()（） "); continue
        lines.append({"text": s, "section": section})
    return lines

def device_auto(pref):
    if pref and pref != "auto": return pref
    try:
        import ctranslate2
        return "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    except Exception:
        return "cpu"

def separate(prj, wav, force):
    a = prj.cfg["asr"]; model = a.get("demucs_model", "htdemucs")
    voc = prj.p("work", "sep", model, "song", "vocals.wav")
    if os.path.exists(voc) and not force: return voc
    dev = device_auto(a.get("device"))
    try:
        import torch; dev = "cuda" if (dev == "cuda" and torch.cuda.is_available()) else "cpu"
    except Exception:
        dev = "cpu"
    run([sys.executable, "-m", "demucs", "--two-stems", "vocals", "-n", model, "-d", dev, "-o", prj.p("work", "sep"), wav])
    if not os.path.exists(voc): die("demucs finished but vocals.wav not found at " + voc)
    return voc

def transcribe(prj, vocals, lyrics, force):
    out = prj.p("work", "asr.json")
    if os.path.exists(out) and not force: return json.load(open(out, encoding="utf-8"))
    from faster_whisper import WhisperModel
    a = prj.cfg["asr"]; dev = device_auto(a.get("device"))
    ct = a.get("compute_type", "auto"); ct = ("float16" if dev == "cuda" else "int8") if ct == "auto" else ct
    print(f"faster-whisper {a['model']} on {dev}/{ct} (first run downloads the model)", flush=True)
    m = WhisperModel(a["model"], device=dev, compute_type=ct, cpu_threads=max(1, (os.cpu_count() or 4)))
    prompt = None
    if lyrics and a.get("prompt_with_lyrics", True):
        prompt = "，".join(l["text"] for l in lyrics)[:600]
    import librosa   # decode ourselves (avoids PyAV version issues inside faster-whisper)
    aud, _ = librosa.load(vocals, sr=16000, mono=True)
    segs, info = m.transcribe(aud, language=prj.cfg.get("language") or None, word_timestamps=True, initial_prompt=prompt,
                              vad_filter=True, beam_size=a.get("beam_size", 5), condition_on_previous_text=False)
    res = []
    for s in segs:
        ws = [{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)} for w in (s.words or [])]
        res.append({"s": round(s.start, 3), "e": round(s.end, 3), "text": s.text, "words": ws}); print(f"  {s.start:7.2f} {s.end:7.2f} {s.text}", flush=True)
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return res

def beats(prj, wav, force):
    out = prj.p("work", "beats.json")
    if os.path.exists(out) and not force: return json.load(open(out))
    import librosa, numpy as np
    y, sr = librosa.load(wav, sr=22050, mono=True)
    tempo, bt = librosa.beat.beat_track(y=y, sr=sr, units="time")
    on = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    rms = librosa.feature.rms(y=y, hop_length=2205)[0]
    d = {"tempo": float(np.atleast_1d(tempo)[0]), "beats": [round(float(b), 3) for b in bt], "onsets": [round(float(o), 3) for o in on],
         "rms10hz": [round(float(r), 4) for r in rms]}
    json.dump(d, open(out, "w")); return d

class Energy:
    """Vocal energy (dB, 10 ms hop, smoothed) for onset snapping and valley-based line segmentation."""
    def __init__(self, vocals):
        import librosa, numpy as np
        y, sr = librosa.load(vocals, sr=22050); hop = 220
        rms = librosa.feature.rms(y=y, hop_length=hop, frame_length=1024)[0]
        db = 20 * np.log10(rms + 1e-6); k = 15
        self.db = np.convolve(db, np.ones(k) / k, mode="same"); self.t = np.arange(len(db)) * hop / sr
        self.peak = float(np.percentile(self.db, 98)); self.voiced = self.db > self.peak - 20
        on = self.db > self.peak - 30; st = []; prev = False; last = -9
        for i, v in enumerate(on):
            if v and not prev and self.t[i] - last > 0.18: st.append(float(self.t[i]))
            if v: last = self.t[i]
            prev = v
        self.onsets = st
    def span(self, a, b):
        import numpy as np
        m = (self.t >= a) & (self.t <= b) & self.voiced
        if not m.any(): return a, b
        ts = self.t[m]; return float(ts[0]), float(ts[-1])
    def valleys(self, a, b):
        import numpy as np
        m = np.flatnonzero((self.t > a) & (self.t < b)); out = []
        for i in m[::5]:
            lo, hi = max(0, i - 25), min(len(self.db), i + 26)
            if self.db[i] <= self.db[lo:hi].min() + 0.3: out.append((float(self.t[i]), float(self.db[i])))
        return out
    def segment(self, a, b, weights):
        """split voiced span of (a,b) into len(weights) lines at energy valleys, durations ~ proportional to weights (DP)."""
        k = len(weights); s0, s1 = self.span(a, b)
        if k == 1: return [(s0, s1)]
        tot = float(sum(weights)); exp = [(s1 - s0) * w / tot for w in weights]
        V = [v for v in self.valleys(s0 + 0.3, s1 - 0.3)]
        if len(V) < k - 1:   # not enough valleys: proportional split
            out = []; acc = s0
            for e in exp: out.append((acc, acc + e)); acc += e
            return out
        lo_db = min(v[1] for v in V); hi_db = max(v[1] for v in V) + 1e-6
        cand = [(s0, 0.0)] + [(t, (d - lo_db) / (hi_db - lo_db)) for t, d in V] + [(s1, 0.0)]
        M = len(cand); INF = 1e18
        best = [[INF] * M for _ in range(k + 1)]; back = [[-1] * M for _ in range(k + 1)]; best[0][0] = 0
        for i in range(1, k + 1):
            for j in range(1, M):
                if i == k and j != M - 1: continue
                if i < k and j == M - 1: continue
                for p in range(j):
                    if best[i - 1][p] >= INF: continue
                    d = cand[j][0] - cand[p][0]
                    if d < 0.4: continue
                    c = best[i - 1][p] + 4 * ((d - exp[i - 1]) / exp[i - 1]) ** 2 + (cand[j][1] if j < M - 1 else 0)
                    if c < best[i][j]: best[i][j] = c; back[i][j] = p
        if best[k][M - 1] >= INF:
            out = []; acc = s0
            for e in exp: out.append((acc, acc + e)); acc += e
            return out
        idx = [M - 1]
        for i in range(k, 0, -1): idx.append(back[i][idx[-1]])
        idx = idx[::-1]
        out = []
        for i in range(k):   # a line starts where the voice comes back after the valley
            b0, b1 = cand[idx[i]][0], cand[idx[i + 1]][0]
            out.append((self.span(b0, b1)[0], b1))
        return out

def asr_tokens(asr):
    out = []   # (token, start, end)
    for s in asr:
        if not s["words"]:   # faster-whisper sometimes returns a segment without word timings: spread its text,
            tk = toks(s["text"])   # at most 0.6 s per token from the segment start (segment ends are often hallucinated)
            if tk:
                d = min(0.6, (s["e"] - s["s"]) / len(tk))
                for k, t in enumerate(tk): out.append((t, s["s"] + k * d, s["s"] + (k + 1) * d, True))
            continue
        for w in s["words"]:
            tk = toks(w["w"])
            if not tk: continue
            d = (w["e"] - w["s"]) / len(tk)
            for k, t in enumerate(tk): out.append((t, w["s"] + k * d, w["s"] + (k + 1) * d, False))
    return out

def align(lyrics, asr, song_dur, en):
    A = asr_tokens(asr)
    L = []
    for li, l in enumerate(lyrics):
        tk = toks(l["text"]); l["_n"] = len(tk); L += tk
    sm = difflib.SequenceMatcher(None, L, [x[0] for x in A], autojunk=False)
    tmap = {}
    for blk in sm.get_matching_blocks():
        if blk.size < 2: continue          # single-character matches are mostly coincidences
        for k in range(blk.size): tmap[blk.a + k] = A[blk.b + k]
    res = []; pos = 0
    for li, l in enumerate(lyrics):
        idx = list(range(pos, pos + l["_n"])); pos += l["_n"]
        m = [(i, tmap[i]) for i in idx if i in tmap]
        r = {"text": l["text"], "section": l["section"], "match": round(len(m) / max(1, len(idx)), 2), "how": "asr"}
        if m and r["match"] >= 0.4:
            per = sum(t[2] - t[1] for _, t in m) / len(m)
            i0, t0 = m[0]; i1, t1 = m[-1]
            if any(t[3] for _, t in m): r["how"] = "asr-segment"
            r["song_start"] = max(0.0, t0[1] - (i0 - idx[0]) * per); r["song_end"] = min(song_dur, t1[2] + (idx[-1] - i1) * per)
            parts = re.split(r"[，,、；;]", l["text"], maxsplit=1)
            if len(parts) == 2 and toks(parts[0]) and toks(parts[1]):
                j = idx[0] + len(toks(parts[0]))
                if j in tmap: r["split_song"] = round(tmap[j][1], 2)
        res.append(r)
    # runs of unanchored lines: split the vocal activity between the neighbouring anchors at energy valleys
    i = 0
    while i < len(res):
        if "song_start" in res[i]: i += 1; continue
        j = i
        while j < len(res) and "song_start" not in res[j]: j += 1
        a = res[i - 1]["song_end"] if i > 0 else 0.0
        b = res[j]["song_start"] if j < len(res) else song_dur
        for k, (s0, s1) in enumerate(en.segment(a, b, [max(1, lyrics[q]["_n"]) for q in range(i, j)])):
            res[i + k]["song_start"] = s0; res[i + k]["song_end"] = s1; res[i + k]["how"] = "energy"
        i = j
    prev_end = 0.0
    for r in res:   # monotonic; snap starts to a vocal onset just before (within 0.3 s)
        s = max(r["song_start"], prev_end)
        c = [o for o in en.onsets if s - 0.3 <= o <= s + 0.1 and o >= prev_end - 0.05]
        if c: s = max(c[0], prev_end)
        r["song_start"] = round(s, 2); r["song_end"] = round(max(r["song_end"], s + 0.3), 2); prev_end = r["song_end"]
    return res

def lines_from_asr(asr):
    out = []
    for s in asr:
        txt = s["text"].strip()
        if txt: out.append({"text": txt, "section": "", "song_start": round(s["s"], 2), "song_end": round(s["e"], 2), "match": 1.0})
    return out

def build_timeline(prj, force=False, skip_asr=False):
    c = prj.cfg
    if os.path.exists(prj.timeline_file) and not force and json.load(open(prj.timeline_file, encoding="utf-8")).get("locked"):
        print('timeline.json is locked ("locked": true) - kept as is. Remove the flag or use --force to rebuild.')
        return json.load(open(prj.timeline_file, encoding="utf-8"))
    if not c.get("audio"): die('project.json needs "audio"')
    src = prj.p(c["audio"])
    if not os.path.exists(src): die("audio not found: " + src)
    wav = prj.p("work", "song.wav")
    if force or not os.path.exists(wav):
        run([ffmpeg(), "-v", "error", "-y", "-i", src, "-ac", "2", "-ar", "44100", wav])
    import soundfile as sf
    song_dur = round(sf.info(wav).duration, 3)
    lyrics = read_lyrics(prj.p(c["lyrics"])) if c.get("lyrics") and os.path.exists(prj.p(c["lyrics"])) else None
    bt = beats(prj, wav, force)
    vocals = separate(prj, wav, force) if c["asr"].get("demucs", True) else wav
    asr = transcribe(prj, vocals, lyrics, force)
    en = Energy(vocals)
    if lyrics:
        lines = align(lyrics, asr, song_dur, en)
    else:
        print("no lyrics file: lines come from ASR text - CHECK THE TEXT (ask the user for the official lyrics)")
        lines = lines_from_asr(asr)
    lead = float(c["lead_in"])
    out_lines = []
    for i, r in enumerate(lines):
        conf = "medium (segment-level ASR)" if r.get("how") == "asr-segment" else "high" if r["match"] >= .8 else "medium" if r["match"] >= .5 else "low (energy valleys)" if r.get("how") == "energy" else "low"
        o = {"i": i + 1, "section": r.get("section", ""), "text": r["text"], "song_start": r["song_start"], "song_end": r["song_end"],
             "video_start": round(r["song_start"] + lead, 2), "video_end": round(r["song_end"] + lead, 2), "confidence": conf, "match": r["match"]}
        if r.get("split_song") is not None: o["split_song"] = r["split_song"]
        out_lines.append(o)
    tl = {"title": c.get("title", ""), "audio": c["audio"], "song_duration": song_dur, "video_offset_s": lead,
          "notes": ["video time = song time + lead_in", "lyric text is used VERBATIM by the engine - fix typos here, never in scenes.js",
                    "auto-aligned with faster-whisper; review low/medium confidence lines"],
          "tempo_bpm": round(bt["tempo"], 1), "beats_song_time": bt["beats"], "lines": out_lines}
    out = prj.timeline_file
    json.dump(tl, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(prj.p("work", "timeline_review.md"), "w", encoding="utf-8") as f:
        f.write(f"# Timeline review ({len(out_lines)} lines, song {song_dur:.1f}s, tempo {bt['tempo']:.0f} bpm, lead-in {lead}s)\n\n")
        f.write("| # | section | song start-end | video start | conf | text |\n|---|---|---|---|---|---|\n")
        for o in out_lines:
            f.write(f"| {o['i']} | {o['section']} | {o['song_start']:.2f}-{o['song_end']:.2f} | {o['video_start']:.2f} | {o['confidence']} ({o['match']}) | {o['text']} |\n")
        f.write("\nASR raw (vocals):\n\n")
        for s in asr: f.write(f"- {s['s']:.2f}-{s['e']:.2f} {s['text']}\n")
    print(f"timeline: {len(out_lines)} lines -> {out}")
    for o in out_lines: print(f"  {o['i']:3d} {o['video_start']:7.2f} {o['confidence']:6s} {o['text']}")
    low = [o["i"] for o in out_lines if o["confidence"] != "high"]
    if low: print("REVIEW these lines (listen around their times):", low)
    return tl
