"""Shared helpers: project config loading, path resolution, tool discovery (Linux/macOS/Windows)."""
import json, os, sys, shutil, subprocess, copy

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULTS = {
    "title": "",
    "audio": None,              # required: song file (mp3/wav/flac/m4a)
    "lyrics": None,             # optional: lyrics.txt, one sung line per row (blank lines / [Section] headers allowed)
    "language": "zh",
    "lead_in": 1.0,             # seconds of silence before the song starts (title card time). video time = song time + lead_in
    "tail": 0.0,                # extra seconds after the song ends
    "duration": None,           # override total video duration (default lead_in + song_duration + tail)
    "audio_fade_out": 2.0,      # fade the music out over the last N seconds of the video
    "fps": 60, "phone_fps": 30, "sample_seconds": 25,
    "scenes": "scenes.js",
    "sprites_dir": "sprites",
    "sprites": {},              # name -> {"height": display px, "file": optional custom file}
    "preset": "ballpoint",      # visual style preset (presets/<name>.json): palette, paper, fonts, style.* - see references/STYLE.md
    "logo": None,               # {"file": "logo/x.svg", "height": 66, "right": 58, "top": 45, "ink": 0.82, "recolor": true}
    "credits": [],
    "asr": {"model": "large-v3", "device": "auto", "compute_type": "auto", "demucs": True,
            "demucs_model": "htdemucs", "beam_size": 5, "prompt_with_lyrics": True},
    "prep": {},                 # threshold overrides for scripts/prep.py (see references/CONFIG.md)
    "render": {"workers": 0, "chunk_seconds": 3, "chunk_crf": 14, "main_crf": 18, "phone_crf": 23},
    "output_name": "lyric_mv",
    # ---- input / music modes (see SKILL.md) ----
    "mode": None,               # "song" (audio + lyric sync) | "script" (script.json, no song needed); auto: script if script.json exists and no audio
    "script": "script.json",
    "music": {"mode": None, "file": None, "offset": 0.0, "fade_in": 0.5, "fade_out": 2.0, "lufs": -16, "engine": "synth", "soundfont": None},
                                # mode: "song" (lyric sync) | "none" (silent/foley) | "external" (file, `bpmv.py mux`) | "auto" (composed, scripts/music.py)
                                # engine (auto): "synth" (offline default) | "fluidsynth" (+soundfont .sf2) | "lyria" (needs GEMINI_API_KEY)
    "foley": {"enabled": False, "level_db": -24},   # procedural pen-scratch / page-flip / eraser sounds
}

def load_preset(name):
    f = os.path.join(SKILL_DIR, "presets", f"{name}.json")
    if not os.path.exists(f):
        die(f"style preset not found: {f}")
    with open(f, encoding="utf-8") as fh:
        d = json.load(fh)
    d.pop("_comment", None)
    return d

def deep_merge(a, b):
    out = copy.deepcopy(a)
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out

class Project:
    def __init__(self, cfg_path):
        self.cfg_path = os.path.abspath(cfg_path)
        self.dir = os.path.dirname(self.cfg_path)
        with open(self.cfg_path, encoding="utf-8") as f:
            raw = json.load(f)
        base = deep_merge(DEFAULTS, load_preset(raw.get("preset") or DEFAULTS["preset"]))
        self.cfg = deep_merge(base, raw)
        c = self.cfg
        if not c.get("mode"):
            c["mode"] = "song" if c.get("audio") else "script"
        if not c["music"].get("mode"):
            c["music"]["mode"] = "song" if c["mode"] == "song" else ("external" if c["music"].get("file") else "none")
        if c["mode"] == "script":
            c["lead_in"] = 0.0
        # font fallback: a missing/unreadable font file never blocks a build - use the bundled OFL Yozai instead
        good = [f for f in c.get("fonts", []) if os.path.exists(self.p(f.get("file", "")))]
        if len(good) != len(c.get("fonts", [])) or c.get("hand_font") not in [f["family"] for f in good]:
            bad = [f.get("file") for f in c.get("fonts", []) if f not in good]
            print(f"WARN font fallback: {bad or c.get('hand_font')} not found -> using bundled Yozai (SIL OFL 1.1, licenses/OFL-Yozai.txt)")
            good = [f for f in good if f.get("family") != "Yozai"] + [{"family": "Yozai", "file": "@skill/fonts/Yozai-Regular.ttf"}]
            if c.get("hand_font") not in [f["family"] for f in good]: c["hand_font"] = "Yozai"
            c["fonts"] = good
        for d in ("work", "data", "build", "chunks", "out"):
            os.makedirs(self.p(d), exist_ok=True)
        # optional hand-written timeline (e.g. a demo song without vocals): copied to work/timeline.json on first use
        ts = c.get("timeline_seed")
        if ts and os.path.exists(self.p(ts)) and not os.path.exists(self.p("work", "timeline.json")):
            shutil.copyfile(self.p(ts), self.p("work", "timeline.json"))

    def p(self, *parts):
        """Path inside the project; '@skill/...' resolves inside the skill package."""
        if parts and isinstance(parts[0], str) and parts[0].startswith("@skill/"):
            return os.path.normpath(os.path.join(SKILL_DIR, parts[0][7:], *parts[1:]))
        if parts and os.path.isabs(parts[0]):
            return os.path.normpath(os.path.join(*parts))
        return os.path.normpath(os.path.join(self.dir, *parts))

    @property
    def timeline_file(self):
        return self.p("work", "timeline.json")

    def song_duration(self):
        if os.path.exists(self.timeline_file):
            with open(self.timeline_file, encoding="utf-8") as f:
                return json.load(f)["song_duration"]
        return probe_duration(self.p(self.cfg["audio"]))

    def duration(self):
        c = self.cfg
        if c.get("duration"):
            return float(c["duration"])
        return round(c["lead_in"] + self.song_duration() + c["tail"], 3)

    def engine_cfg(self):
        """Resolved config handed to the JS engine (absolute paths)."""
        c = copy.deepcopy(self.cfg)
        c["fonts"] = [{"family": f["family"], "file": self.p(f["file"])} for f in c["fonts"]]
        for f in c["fonts"]:
            if not os.path.exists(f["file"]):
                die(f"font file not found: {f['file']}  (see fonts/README.md)")
        if c.get("logo") and c["logo"].get("file"):
            c["logo"]["file"] = self.p(c["logo"]["file"])
        c["timeline_file"] = self.timeline_file
        c["plan_file"] = self.p("work", "plan.json")
        c["data_dir"] = self.p("data")
        c["duration"] = self.duration()
        return c

def die(msg, code=1):
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(code)

def which(name, env=None):
    p = os.environ.get(env or "", "") if env else ""
    return p or shutil.which(name) or shutil.which(name + ".exe")

def ffmpeg():
    p = which("ffmpeg", "FFMPEG")
    if not p:
        die("ffmpeg not found on PATH (Windows: winget install Gyan.FFmpeg ; Linux: apt install ffmpeg)")
    return p

def ffprobe():
    return which("ffprobe", "FFPROBE") or "ffprobe"

def node():
    p = which("node", "NODE")
    if not p:
        die("node not found on PATH (need Node.js >= 18)")
    return p

def probe_duration(path):
    out = subprocess.run([ffprobe(), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
                         capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        die(f"cannot read duration of {path}: {out.stderr[-300:]}")

def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd), flush=True)
    r = subprocess.run([str(c) for c in cmd], **kw)
    if r.returncode != 0:
        die(f"command failed ({r.returncode}): {cmd[0]}")
    return r
