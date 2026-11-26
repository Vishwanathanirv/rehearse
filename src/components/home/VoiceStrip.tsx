"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAPTURE_WORKLET } from "@/lib/voice/capture";
import { ProsodyTracker, type VoiceMetrics } from "@/lib/voice/prosody";

type Trace = { t: number; f0: number | null; speech: boolean }[];
type Pause = { from: number; to: number };

const MAX_SEC = 12;

/**
 * A spoken sample built from a pitch plan (three phrases that start high and fall, with pauses
 * between them), turned into real audio samples and run through the same tracker that grades
 * interview answers. Nothing here is drawn by hand: the curve on screen is what YIN hears.
 */
function sampleVoice(sr = 16_000) {
  const phrases = [
    [0.25, 1.8],
    [2.9, 4.85],
    [5.85, 7.9],
  ];
  const out = new Float32Array(Math.round(sr * 8.2));
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.002;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let v = noise();
    const n = phrases.findIndex(([a, b]) => t >= a && t < b);
    if (n >= 0) {
      const [a, b] = phrases[n];
      const k = (t - a) / (b - a);
      // Starts high and falls through the phrase (the middle one lifts at the end, like a
      // question), with uneven stresses on top so it moves like speech, not a sine wave.
      const lift = n === 1 && k > 0.78 ? (k - 0.78) * 30 : 0;
      const st = 4.5 - 8 * k + lift + 2.1 * Math.sin(2 * Math.PI * 1.3 * t + n) + 1.1 * Math.sin(2 * Math.PI * 3.7 * t + 2 * n) * (1 - k * 0.5);
      const f0 = 132 * 2 ** (st / 12);
      phase += (2 * Math.PI * f0) / sr;
      const syll = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * (4.2 + n * 0.7) + Math.sin(t * 5)));
      const edge = Math.min(1, (t - a) / 0.04, (b - t) / 0.04);
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(phase * h) / h;
      v += 0.18 * syll * edge * s;
    }
    out[i] = v;
  }
  return { samples: out, sr };
}

function pausesOf(trace: Trace): Pause[] {
  const first = trace.findIndex((f) => f.speech);
  let last = -1;
  for (let i = trace.length - 1; i >= 0; i--) if (trace[i].speech) { last = i; break; }
  if (first < 0) return [];
  const out: Pause[] = [];
  let start = -1;
  for (let i = first; i <= last; i++) {
    if (!trace[i].speech && start < 0) start = i;
    if (trace[i].speech && start >= 0) {
      if (trace[i].t - trace[start].t >= 0.6) out.push({ from: trace[start].t, to: trace[i].t });
      start = -1;
    }
  }
  return out;
}

function readVars(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { pen: v("--pen"), pencil: v("--pencil"), grid: v("--grid-major"), faint: v("--faint") };
}

function draw(canvas: HTMLCanvasElement, trace: Trace, reveal: number) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr);
  if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const c = readVars(canvas);
  const left = 8;
  const right = W - 8;
  const top = 18;
  const base = H - 46; // the pitch area ends here; pause brackets sit below
  const span = Math.max(8, trace.length ? trace[trace.length - 1].t : 0);
  const x = (t: number) => left + (t / span) * (right - left);

  // Time ruler: a tick every second.
  g.strokeStyle = c.grid;
  g.fillStyle = c.faint;
  g.lineWidth = 1;
  g.font = "11px Inter Variable, Inter, sans-serif";
  g.beginPath();
  g.moveTo(left, base + 0.5);
  g.lineTo(right, base + 0.5);
  g.stroke();
  for (let s = 0; s <= span; s++) {
    g.beginPath();
    g.moveTo(Math.round(x(s)) + 0.5, base);
    g.lineTo(Math.round(x(s)) + 0.5, base + 5);
    g.stroke();
    if (s > 0 && s < span) g.fillText(`${s}s`, x(s) + 3, base + 14);
  }

  const shown = trace.filter((f) => f.t <= reveal);
  const f0s = shown.filter((f) => f.speech && f.f0).map((f) => f.f0!) as number[];
  if (f0s.length) {
    const sorted = [...f0s].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const y = (f: number) => {
      const st = Math.max(-11, Math.min(11, 12 * Math.log2(f / med)));
      return top + ((11 - st) / 22) * (base - top - 10);
    };
    // The pitch line: the pen lifts across gaps longer than ~120 ms.
    g.strokeStyle = c.pen;
    g.lineWidth = 2.5;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.beginPath();
    let prev: { t: number } | null = null;
    for (const f of shown) {
      if (!f.speech || !f.f0 || f.f0 < med / 2 || f.f0 > med * 2) continue;
      if (prev && f.t - prev.t <= 0.12) g.lineTo(x(f.t), y(f.f0));
      else g.moveTo(x(f.t), y(f.f0));
      prev = f;
    }
    g.stroke();
  }

  // Red-pencil brackets under every pause of 0.6 s or more, with its length.
  g.strokeStyle = c.pencil;
  g.fillStyle = c.pencil;
  g.lineWidth = 1.6;
  g.font = "600 12px Inter Variable, Inter, sans-serif";
  for (const p of pausesOf(shown)) {
    const a = x(p.from);
    const b = x(p.to);
    const yb = base + 24;
    g.beginPath();
    g.moveTo(a, yb - 6);
    g.lineTo(a, yb);
    g.lineTo(b, yb);
    g.lineTo(b, yb - 6);
    g.stroke();
    const label = `${(p.to - p.from).toFixed(1)}s`;
    const w = g.measureText(label).width;
    g.fillText(label, (a + b) / 2 - w / 2, yb + 15);
  }
}

export function VoiceStrip() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sample = useMemo(() => {
    if (typeof window === "undefined") return null;
    const { samples, sr } = sampleVoice();
    const tr = new ProsodyTracker(sr);
    tr.push(samples);
    return { trace: tr.trace(), summary: tr.summary() };
  }, []);
  const [trace, setTrace] = useState<Trace>([]);
  const [summary, setSummary] = useState<VoiceMetrics | null>(null);
  const [mode, setMode] = useState<"sample" | "live" | "yours">("sample");
  const [note, setNote] = useState<string | null>(null);
  const reveal = useRef(Infinity);
  const live = useRef<{ stop: () => void } | null>(null);

  const repaint = useCallback(() => {
    if (canvas.current) draw(canvas.current, trace, reveal.current);
  }, [trace]);

  // The sample is written in once, left to right, the first time the page opens.
  useEffect(() => {
    if (!sample) return;
    setTrace(sample.trace);
    setSummary(sample.summary);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    reveal.current = 0;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      reveal.current = ((now - start) / 2200) * 8.2;
      if (canvas.current) draw(canvas.current, sample.trace, reveal.current);
      if (reveal.current < 8.2) raf = requestAnimationFrame(step);
      else reveal.current = Infinity;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sample]);

  useEffect(() => {
    repaint();
    const onResize = () => repaint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [repaint]);

  useEffect(() => () => live.current?.stop(), []);

  async function start() {
    setNote(null);
    reveal.current = Infinity;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    } catch {
      setNote("Your microphone is blocked, so you're seeing the sample voice. Allow the microphone in the address bar to try your own.");
      return;
    }
    const ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "mv-capture");
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    const tracker = new ProsodyTracker(ctx.sampleRate);
    let raf = 0;
    let dirty = false;
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      setTrace(tracker.trace());
      setSummary(tracker.summary());
      setMode("yours");
      live.current = null;
    };
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      tracker.push(e.data);
      dirty = true;
    };
    const loop = () => {
      if (dirty && canvas.current) {
        dirty = false;
        draw(canvas.current, tracker.trace(), Infinity);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timer = setTimeout(stop, MAX_SEC * 1000);
    live.current = { stop };
    setMode("live");
  }

  const s = summary;
  const verdict =
    !s || s.pitchSdSemitones === null
      ? null
      : s.monotone
        ? "Flat. Most interviewers hear this as low energy."
        : s.pitchSdSemitones > 4
          ? "Very lively, maybe a little sing-song."
          : "Varied, the way engaged speakers sound.";

  return (
    <div>
      <div className="relative rounded-md border-[1.5px] border-pen/70 bg-paper">
        <canvas ref={canvas} className="block h-[220px] w-full sm:h-[260px]" role="img" aria-label="Pitch of the voice over time, with pauses marked underneath" />
        {mode === "live" && (
          <span className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-paper/90 px-2.5 py-1 text-sm text-pencil">
            <span className="h-2 w-2 animate-pulse rounded-full bg-pencil" aria-hidden />
            Listening
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4" aria-live="polite">
          <div>
            <dt className="text-muted">Pitch range</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold text-pen">{s?.pitchRangeSemitones != null ? `${s.pitchRangeSemitones} st` : "–"}</dd>
          </div>
          <div>
            <dt className="text-muted">Pauses over 0.6s</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold text-pencil">{s ? s.pauses : "–"}</dd>
          </div>
          <div>
            <dt className="text-muted">Longest pause</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold text-pencil">{s ? `${s.longestPauseSec}s` : "–"}</dd>
          </div>
          <div>
            <dt className="text-muted">Talking</dt>
            <dd className="mt-0.5 font-display text-2xl font-semibold text-pen">{s ? `${s.speakingSec}s` : "–"}</dd>
          </div>
        </dl>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          {mode === "live" ? (
            <button type="button" className="btn btn-primary" onClick={() => live.current?.stop()}>
              Stop and measure
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={start}>
              {mode === "yours" ? "Record again" : "Record your voice"}
            </button>
          )}
          <p className="text-sm text-faint">Up to {MAX_SEC} seconds. Your audio never leaves this page.</p>
        </div>
      </div>
      <p className="mt-3 min-h-6 text-[0.95rem] text-muted">
        {note ??
          (mode === "live"
            ? "Talk about your last project, the way you would in an interview."
            : verdict
              ? `${mode === "yours" ? "You" : "This sample"}: ${verdict}`
              : mode === "yours"
                ? "We didn't hear enough voice to measure. Speak a little closer to the microphone."
                : "")}
      </p>
    </div>
  );
}
