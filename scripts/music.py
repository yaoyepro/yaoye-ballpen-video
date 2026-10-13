"""AUTO music: compose + render a backing track that follows the film's plan (offline, deterministic, no samples needed).

Input : work/plan.json (script mode) or work/timeline.json (song mode is not scored - it has its own song), mood/pace from script.json
Output: work/music_auto.wav (+ work/music_auto.mid for re-use in a DAW / with a soundfont)
Engines (project.json "music": {"mode": "auto", "engine": ...}):
  "synth"  (default) built-in numpy synth: soft piano arpeggios, warm pad, bass, bell melody, light percussion when lively,
           chimes on page flips/erasers, reverb; tempo/key/progression from pace + mood words
  "fluidsynth"  renders the generated MIDI with a General-MIDI soundfont: needs the `fluidsynth` binary and "soundfont": "x.sf2"
  "lyria"  Google Lyria (RealTime) via google-genai when GEMINI_API_KEY is set; any failure falls back to "synth"
Loudness (-16 LUFS integrated, true peak <= -1.5 dBTP) is applied later in scripts/audio.py together with the pen foley.
"""
import json, math, os, shutil, struct, subprocess, zlib
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import soundfile as sf
from common import die, run

SR = 44100
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SAD = ("sad", "nostalg", "quiet", "night", "lonely", "miss", "melanch", "moon", "calm night", "思", "静", "夜", "孤", "愁", "念", "月")
BRIGHT_PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]          # I  V  vi IV
WARM_PROG = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]           # I  vi IV V
SAD_PROG = [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]]            # vi IV I  V
MAJOR = [0, 2, 4, 5, 7, 9, 11]

def _lp(x, f, o=2): return sosfilt(butter(o, f, btype="low", fs=SR, output="sos"), x)
def _hp(x, f, o=2): return sosfilt(butter(o, f, btype="high", fs=SR, output="sos"), x)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def env_adsr(n, a, d, s, r, sus_n=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.zeros(n)
    sus_n = sus_n if sus_n is not None else max(0, n - a - d - r)
    seg = [np.linspace(0, 1, max(1, a), endpoint=False), np.linspace(1, s, max(1, d), endpoint=False), np.full(sus_n, s), np.linspace(s, 0, max(1, r))]
    v = np.concatenate(seg)[:n]; e[:len(v)] = v
    return e

class Track:
    def __init__(self, dur):
        self.n = int((dur + 4) * SR); self.L = np.zeros(self.n); self.R = np.zeros(self.n)
    def add(self, t, sig, pan=0.0, gain=1.0):
        a = int(t * SR); b = min(self.n, a + len(sig))
        if b <= a: return
        s = sig[:b - a] * gain
        self.L[a:b] += s * math.cos((pan + 1) * math.pi / 4); self.R[a:b] += s * math.sin((pan + 1) * math.pi / 4)

def piano(m, dur, vel=0.6, rng=None):
    n = int((dur + 1.4) * SR); t = np.arange(n) / SR; f = hz(m); y = np.zeros(n)
    for k, amp in enumerate([1, .5, .28, .14, .07], 1):
        fk = f * k * (1 + 0.0004 * k * k)
        y += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.6 + .9 * k) * (0.8 + f / 900))
    y *= np.minimum(1, t / .004) * np.where(t < dur, 1, np.exp(-(t - dur) * 8))
    return y * vel * .35

def bell(m, vel=0.5):
    n = int(2.4 * SR); t = np.arange(n) / SR; f = hz(m)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.2), (2.76, .35, 4), (5.4, .18, 7), (2.0, .25, 3)])
    return y * np.minimum(1, t / .002) * vel * .3

def pad(ms, dur):
    n = int((dur + .8) * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for m in ms:
        for det in (-.07, .07):
            ph = 2 * np.pi * hz(m + det) * t
            y += (np.sin(ph) + .35 * np.sin(2 * ph) + .15 * np.sin(3 * ph))
    y = _lp(y, 1400) * env_adsr(n, .5, .3, .8, .8, sus_n=max(0, int((dur - .8) * SR)))
    return y * .045

def bass(m, dur):
    n = int((dur + .3) * SR); t = np.arange(n) / SR; f = hz(m)
    y = (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 1.6) * np.minimum(1, t / .01)
    return y * .22

def kick():
    n = int(.35 * SR); t = np.arange(n) / SR; f = 110 * np.exp(-t * 18) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * .35

def shaker(rng):
    n = int(.09 * SR); t = np.arange(n) / SR
    return _hp(rng.standard_normal(n), 5000) * np.exp(-t * 55) * .05

def swell(rng, d=0.7):
    n = int(d * SR); u = np.linspace(0, 1, n)
    return _lp(_hp(rng.standard_normal(n), 2500), 9000) * u ** 2.5 * .06

def reverb(x, rng, secs=1.9, wet=.22):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs); ir = _lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + fftconvolve(x, ir)[:len(x)] * wet

# ------------------------------------------------------------------ composition
def compose(plan, sc, seed_text):
    seed = zlib.crc32(seed_text.encode("utf-8")); rng = np.random.default_rng(seed)
    pace = sc.get("pace", "normal"); bpm = {"calm": 76, "normal": 96, "lively": 116}.get(pace, 92)
    words = (sc.get("mood", "") + " " + " ".join(p.get("mood", "") for p in sc.get("pages", []))).lower()
    sad = sum(w in words for w in SAD) >= 2
    prog = SAD_PROG if sad else (BRIGHT_PROG if pace == "lively" else WARM_PROG)
    root = 48 + [0, 2, 5, 7][seed % 4]          # C3 / D3 / F3 / G3
    beat = 60.0 / bpm; bar = 4 * beat; dur = plan["duration"]
    nbar = int(math.ceil(dur / bar))
    # section of each bar: title(intro) / page / end(outro); transitions as accents
    def sec_at(t):
        for p in plan["pages"]:
            if p["t0"] - .01 <= t < p["t1"]: return p["kind"]
        return "end"
    trans = [p["enter"]["t0"] for p in plan["pages"] if p.get("enter")]
    events = []      # (t, dur, midi, vel, instr)
    prev_mel = root + 24
    for b in range(nbar):
        t0 = b * bar; ch = prog[b % 4]; kind = sec_at(t0 + .01)
        tones = [root + i for i in ch]
        last = t0 + bar > dur - .01
        events.append((t0, bar, [m for m in tones] + [root + ch[0] - 12], .5, "pad"))
        events.append((t0, bar * .9, root + ch[0] - 12, .7, "bass"))
        if pace != "calm": events.append((t0 + 2 * beat, bar * .4, root + ch[0] - 12, .5, "bass"))
        arp = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[1] + 12 + (12 if b % 2 else 0)]
        steps = 8 if pace != "calm" else 4
        for k in range(steps):
            m = arp[k % 4] + (12 if k >= 4 and kind != "title" else 0) * 0
            v = (.45 if k % 2 == 0 else .32) * (.7 if kind in ("title", "end") else 1)
            events.append((t0 + k * bar / steps, bar / steps * 1.6, m, v, "piano"))
        if kind == "sheet" and not last:     # simple bell melody: 2-bar phrases, chord tones + steps, rest at phrase end
            scale = [root + 24 + s for s in MAJOR] + [root + 36 + s for s in MAJOR]
            nn = [0, 1, 1.5, 2, 3] if b % 2 == 0 else [0, 1, 2]
            for pos in nn:
                cand = [m for m in scale if (m - root) % 12 in [(c % 12) for c in ch]] if pos in (0, 2) else scale
                cand = sorted(cand, key=lambda m: abs(m - prev_mel) + rng.random() * 3)
                m = cand[0] if abs(cand[0] - prev_mel) > 0 or len(cand) < 2 else cand[1]
                prev_mel = m
                events.append((t0 + pos * beat, beat * .9, m, .42, "bell"))
        if pace != "calm" and kind == "sheet":
            for k in range(8): events.append((t0 + k * beat / 2, .1, 0, .6 if k % 2 else .35, "shaker"))
            if pace == "lively": events += [(t0, .3, 0, .8, "kick"), (t0 + 2 * beat, .3, 0, .6, "kick")]
    for t in trans:
        events.append((t, 2, root + 36, .45, "bell")); events.append((max(0, t - .7), .7, 0, 1, "swell"))
    # final chord
    events.append((max(0, dur - 3.2), 3.0, [root, root + 7, root + 12, root + 16], .7, "pad"))
    events.append((max(0, dur - 3.2), 2.8, root + 24, .5, "piano"))
    return {"bpm": bpm, "root": root, "sad": sad, "events": events, "duration": dur}

def render_synth(comp, out):
    rng = np.random.default_rng(11); T = Track(comp["duration"])
    for t, d, m, v, ins in comp["events"]:
        if ins == "pad": T.add(t, pad(m, d) * v * 2, pan=0)
        elif ins == "bass": T.add(t, bass(m, d) * v, pan=0)
        elif ins == "piano": T.add(t, piano(m, d, v), pan=-.25 + .5 * ((m % 7) / 7))
        elif ins == "bell": T.add(t, bell(m, v), pan=.3)
        elif ins == "shaker": T.add(t, shaker(rng) * v, pan=.4)
        elif ins == "kick": T.add(t, kick() * v, pan=0)
        elif ins == "swell": T.add(t, swell(rng, d), pan=-.2)
    L, R = reverb(T.L, rng), reverb(T.R, np.random.default_rng(12))
    n = int(comp["duration"] * SR); y = np.stack([L[:n], R[:n]], 1)
    fo = int(min(2.5, comp["duration"] * .1) * SR); y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    y /= max(1e-9, np.abs(y).max()) / .7
    sf.write(out, y, SR)

def write_midi(comp, out):
    """minimal type-0 MIDI writer (GM: piano ch0, pad ch1 prog 89, bass ch2 prog 33, bell ch3 prog 9, drums ch9)"""
    tpq = 480; bpm = comp["bpm"]; spt = 60.0 / bpm / tpq
    ch = {"piano": (0, 0), "pad": (1, 89), "bass": (2, 33), "bell": (3, 9)}
    ev = []
    for t, d, m, v, ins in comp["events"]:
        ms = m if isinstance(m, list) else [m]
        if ins in ch:
            c = ch[ins][0]
            for x in ms: ev.append((t, 0x90 | c, x, int(min(127, 30 + v * 90)))); ev.append((t + d, 0x80 | c, x, 0))
        elif ins in ("kick", "shaker"):
            x = 36 if ins == "kick" else 70; ev.append((t, 0x99, x, int(40 + v * 70))); ev.append((t + .1, 0x89, x, 0))
    ev.sort(key=lambda e: (e[0], e[1] & 0xF0 == 0x90))
    data = bytearray(); tempo = int(60_000_000 / bpm)
    data += b"\x00\xff\x51\x03" + tempo.to_bytes(3, "big")
    for c, prog in ch.values(): data += bytes([0, 0xC0 | c, prog])
    last = 0
    def vlq(n):
        b = [n & 0x7F]; n >>= 7
        while n: b.insert(0, (n & 0x7F) | 0x80); n >>= 7
        return bytes(b)
    for t, st, x, v in ev:
        tick = int(round(t / spt)); data += vlq(max(0, tick - last)) + bytes([st, x & 0x7F, v]); last = tick
    data += b"\x00\xff\x2f\x00"
    with open(out, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, tpq) + b"MTrk" + struct.pack(">I", len(data)) + data)

def lyria(prompt, dur, out):
    """best effort: Google Lyria RealTime through google-genai (needs GEMINI_API_KEY and network)."""
    import asyncio
    from google import genai
    from google.genai import types
    client = genai.Client(http_options={"api_version": "v1alpha"})
    async def go():
        buf = bytearray()
        async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as s:
            await s.set_weighted_prompts(prompts=[types.WeightedPrompt(text=prompt, weight=1.0)])
            await s.set_music_generation_config(config=types.LiveMusicGenerationConfig(bpm=90, temperature=1.0))
            await s.play()
            async for msg in s.receive():
                if msg.server_content and msg.server_content.audio_chunks:
                    buf += msg.server_content.audio_chunks[0].data
                if len(buf) >= int((dur + 1) * 48000) * 4: break
        return bytes(buf)
    pcm = asyncio.run(asyncio.wait_for(go(), timeout=dur * 3 + 60))
    y = np.frombuffer(pcm, dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768
    sf.write(out, y, 48000)

def auto_music(prj):
    plan_f = prj.p("work", "plan.json")
    if not os.path.exists(plan_f): die("AUTO music needs work/plan.json (script mode: python bpmv.py script)")
    plan = json.load(open(plan_f, encoding="utf-8"))
    sp = prj.p(prj.cfg.get("script", "script.json")); sc = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
    m = prj.cfg.get("music") or {}; eng = m.get("engine", "synth")
    out = prj.p("work", "music_auto.wav"); mid = prj.p("work", "music_auto.mid")
    comp = compose(plan, sc, (sc.get("title") or "") + (sc.get("mood") or ""))
    write_midi(comp, mid)
    if eng == "lyria":
        if os.environ.get("GEMINI_API_KEY"):
            try:
                prompt = f"{sc.get('mood', '')}; gentle instrumental for a hand-drawn notebook animation, {comp['bpm']} bpm, piano, glockenspiel, soft pads"
                lyria(prompt, plan["duration"], out); print("music: Lyria", out); return out
            except Exception as e:
                print("Lyria failed, falling back to the built-in synth:", repr(e)[:300])
        else:
            print("music.engine=lyria but GEMINI_API_KEY is not set - using the built-in synth")
    if eng == "fluidsynth":
        fsb = shutil.which("fluidsynth"); sfp = m.get("soundfont")
        if fsb and sfp and os.path.exists(prj.p(sfp)):
            run([fsb, "-ni", "-F", out, "-r", str(SR), prj.p(sfp), mid]); print("music: fluidsynth", out); return out
        print("fluidsynth or soundfont missing - using the built-in synth")
    render_synth(comp, out)
    print(f"music: built-in synth, {comp['bpm']} bpm, {'minor-ish' if comp['sad'] else 'major'} progression -> {out} (+ {mid})")
    return out
