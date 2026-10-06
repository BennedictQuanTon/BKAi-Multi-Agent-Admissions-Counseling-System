"""Score, sound design and final mix for the BKAi film (adapted from the Weatherise trailer mix).

An original, bright and minimal bed synthesized in code (no samples, nothing to license), locked to the voice timeline:
  · Hook: airy F-major pad and a few felt-piano notes.
  · "So I built…": a filtered riser into a bloom on "Meet BKAi".
  · Features: I–V–vi–IV (F · C · Dm · Bb) at 104 BPM, plucked arpeggio, soft kick and shaker.
  · Proof: the groove lifts; each number lands on a hit.
  · End card: the theme resolves on a held F-major chord.
The voice is EQ'd and compressed, and the music ducks under it.
Inputs: build/vo_raw.wav, build/timeline.json, build/cues.json → build/mix.wav (48 kHz stereo).
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).parent
B = HERE / "build"
SR = 48000
rng = np.random.default_rng(11)
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT


def note(n: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    name, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave + 1) - 69) / 12)


def env(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def lowpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def noise(n):
    return rng.standard_normal(n)


def pad(freqs, dur, amp=0.1, bright=2000, detune=0.0035):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            out += signal.sawtooth(2 * np.pi * f * (1 + d) * t + 0.25 * np.sin(2 * np.pi * 0.2 * t)) * 0.33
    return lowpass(out / len(freqs), bright, 2) * amp


def felt(f, dur=1.6, amp=0.1):
    """Soft felt-piano-ish tone: sine partials with a quick attack and gentle decay."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) + 0.15 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 9)
    return x * np.exp(-t * 2.6) * (1 - np.exp(-t * 400)) * amp


def pluck(f, dur=0.9, amp=0.08):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sin(2 * np.pi * 4 * f * t)
    return x * np.exp(-t * 5.5) * amp


def kick(amp=0.45):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = 55 * (1 + 1.6 * np.exp(-t * 30))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * amp


def shaker(amp=0.05):
    n = int(0.07 * SR)
    return highpass(noise(n), 7000) * np.linspace(1, 0, n) ** 2 * amp


def sub_hit(dur=1.6, amp=0.5, f0=55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.8 * np.exp(-t * 18))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2) * amp


def place(track, x, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= len(track) or i + len(x) <= 0:
        return
    if i < 0:
        x, i = x[-i:], 0
    j = min(len(track), i + len(x))
    track[i:j] += x[: j - i] * gain


def reverb(x, seconds=2.4, mix=0.25, damp=5000):
    n = int(seconds * SR)
    ir = noise(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = lowpass(ir, damp, 1)
    ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - mix) + signal.fftconvolve(x, ir)[: len(x)] * mix


def sfx(name):
    if name == "pop":
        t = np.arange(int(0.18 * SR)) / SR
        return np.sin(2 * np.pi * (520 + 1400 * t) * t) * np.exp(-t * 24) * 0.45
    if name == "hit":
        n = int(1.4 * SR)
        t = np.arange(n) / SR
        return sub_hit(1.4, 0.5, 52) + lowpass(noise(n), 1200) * np.exp(-t * 12) * 0.18 + felt(note("F5"), 1.4, 0.12)
    if name == "whoosh":
        n = int(0.8 * SR)
        t = np.arange(n) / SR
        return bandpass(noise(n), 400, 4000) * np.sin(np.pi * np.clip(t / 0.8, 0, 1)) ** 2 * 0.22
    if name == "riser":
        return np.zeros(1)  # the riser is part of the score
    if name == "chime":
        t = np.arange(int(2.4 * SR)) / SR
        return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(note("F6"), 0.3, 2.4), (note("C7"), 0.2, 3.0), (note("A6"), 0.18, 2.8), (note("F7"), 0.08, 4.2)])
    if name == "type":
        n = int(0.03 * SR)
        return highpass(noise(n), 3000) * np.linspace(1, 0, n) * 0.3
    if name == "click":
        t = np.arange(int(0.12 * SR)) / SR
        return (np.sin(2 * np.pi * 1500 * t) * np.exp(-t * 60) + 0.4 * np.sin(2 * np.pi * 750 * t) * np.exp(-t * 40)) * 0.5
    if name == "tick":
        t = np.arange(int(0.07 * SR)) / SR
        return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 80) * 0.35
    if name == "confirm":
        a = felt(note("C6"), 0.9, 0.22)
        b = felt(note("F6"), 1.2, 0.22)
        out = np.zeros(int(1.4 * SR))
        place(out, a, 0)
        place(out, b, 0.12)
        return out
    raise KeyError(name)


def main():
    tl = json.loads((B / "timeline.json").read_text())
    cues = json.loads((B / "cues.json").read_text())
    L = {l["id"]: l for l in tl["lines"]}
    D = tl["duration"] + 0.2
    N = int(D * SR)
    music = np.zeros(N)

    # Hook: airy pad and sparse felt notes (0 → r1)
    t_r1 = L["r1"]["start"]
    p = pad([note("F3"), note("A3"), note("C4")], t_r1 + 1.0, amp=0.06, bright=1400)
    place(music, p * env(len(p), 2.0, 1.0), 0)
    for i, n in enumerate(["F4", "A4", "C5", "E5", "F4", "C5", "A4", "G4", "F4", "A4", "C5", "D5"]):
        place(music, felt(note(n), 1.8, 0.07), 0.6 + i * BEAT * 1.5)

    # Riser into "Meet BKAi"
    r0, r1 = t_r1 + 0.6, L["r2"]["start"] - 0.02
    n = int((r1 - r0) * SR)
    ramp = np.linspace(0, 1, n) ** 2.2
    place(music, bandpass(noise(n), 500, 7000) * ramp * 0.09, r0)
    for i, nn in enumerate(["F4", "A4", "C5", "F5", "A5", "C6"]):
        place(music, pluck(note(nn), 0.6, 0.05 + i * 0.006), r0 + (r1 - r0) * i / 6)
    place(music, sub_hit(2.2, 0.55, 44), r1)
    bloom = pad([note("F2"), note("C3"), note("F3"), note("A3"), note("C4")], 2.6, amp=0.1, bright=3200)
    place(music, bloom * env(len(bloom), 0.05, 1.6), r1)

    # Features: I–V–vi–IV groove
    t0 = L["r2"]["end"] + 0.3
    t_end = L["n1"]["start"] - 0.25
    chords = [["F2", "F3", "A3", "C4"], ["C2", "E3", "G3", "C4"], ["D2", "D3", "F3", "A3"], ["A#1", "D3", "F3", "A#3"]]
    t, k = t0, 0
    while t < t_end:
        c = chords[k % 4]
        dur = min(BAR, t_end - t) + 0.4
        pp = pad([note(x) for x in c[1:]], dur, amp=0.055, bright=2400)
        place(music, pp * env(len(pp), 0.25, 0.4), t)
        place(music, felt(note(c[0]), BAR, 0.08), t)
        arp = [c[1], c[2], c[3], c[2], c[3], c[2], c[1], c[2]]
        for i, x in enumerate(arp):
            if t + i * BEAT / 2 < t_end:
                place(music, pluck(note(x) * 2, 0.8, 0.045), t + i * BEAT / 2)
        for b in range(4):
            tb = t + b * BEAT
            if tb < t_end:
                if b in (0, 2):
                    place(music, kick(0.32), tb)
                place(music, shaker(0.04), tb + BEAT / 2)
        t += BAR
        k += 1

    # Proof: lift (Bb · C · F), steady kick on every beat
    p0, p1 = L["n1"]["start"] - 0.25, L["e1"]["start"] - 0.3
    lift = [["A#1", "D3", "F3", "A#3"], ["C2", "E3", "G3", "C4"], ["F2", "A3", "C4", "F4"]]
    seg = (p1 - p0) / 3
    for i, c in enumerate(lift):
        pp = pad([note(x) for x in c[1:]], seg + 0.4, amp=0.07, bright=3200)
        place(music, pp * env(len(pp), 0.15, 0.4), p0 + i * seg)
    tb = p0
    while tb < p1:
        place(music, kick(0.38), tb)
        place(music, shaker(0.05), tb + BEAT / 2)
        tb += BEAT

    # End: resolve on F major, long tail
    te = L["e1"]["start"] - 0.1
    endp = pad([note("F2"), note("C3"), note("F3"), note("A3"), note("C4"), note("F4")], D - te, amp=0.09, bright=2800)
    place(music, endp * env(len(endp), 0.08, 2.6), te)
    for i, nn in enumerate(["F4", "A4", "C5", "F5"]):
        place(music, felt(note(nn), 3.0, 0.08), te + 0.05 + i * 0.12)

    music = reverb(music, 2.8, 0.3, 5000)

    fx = np.zeros(N)
    for c in cues:
        place(fx, sfx(c["s"]), c["t"], c["v"])
    fx = reverb(fx, 1.4, 0.16, 6500)

    # Voice: 24k → 48k, HPF, presence, compression, short room
    vo, vsr = sf.read(B / "vo_raw.wav")
    vo = signal.resample_poly(vo, SR, vsr)
    vo = highpass(vo, 80, 2)
    b, a = signal.iirpeak(3200 / (SR / 2), 1.2)
    vo = vo + 0.16 * signal.lfilter(b, a, vo)
    b, a = signal.iirpeak(200 / (SR / 2), 1.0)
    vo = vo + 0.08 * signal.lfilter(b, a, vo)
    w = int(0.02 * SR)
    rms = np.sqrt(np.convolve(vo ** 2, np.ones(w) / w, "same") + 1e-9)
    db = 20 * np.log10(rms)
    vo = vo * 10 ** (np.where(db > -20, -(db + 20) * 0.7, 0) / 20)
    vo = reverb(vo, 0.8, 0.07, 7500)
    vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]

    venv = np.convolve(np.abs(vo), np.ones(int(0.12 * SR)) / int(0.12 * SR), "same")
    venv /= venv.max() + 1e-9
    duck = signal.filtfilt(*signal.butter(1, 4 / (SR / 2)), 1 - 0.55 * np.clip(venv * 4, 0, 1))
    music *= duck
    fx *= 1 - 0.3 * np.clip(venv * 4, 0, 1)

    def norm(x, peak):
        return x / (np.max(np.abs(x)) + 1e-9) * peak

    vo, music, fx = norm(vo, 0.85), norm(music, 0.34), norm(fx, 0.38)
    d = int(0.011 * SR)
    left = vo + music * 0.95 + fx
    right = vo + np.concatenate([np.zeros(d), music[:-d]]) * 0.95 + np.concatenate([np.zeros(d // 2), fx[: -(d // 2)]])
    st = np.tanh(np.stack([left, right], axis=1) * 1.1) / np.tanh(1.1)
    fade = int(1.2 * SR)
    st[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    sf.write(B / "mix.wav", st.astype(np.float32), SR)
    print(f"mix.wav {D:.2f}s · {len(cues)} cues")


if __name__ == "__main__":
    main()
