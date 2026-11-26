"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decideTurn, type TurnDecision } from "@/lib/voice/turn";

const SAID = [
  { label: "A short answer", text: "I would add an index on user id." },
  {
    label: "A long answer",
    text: "I would start by looking at the slow query log, find the query that scans the whole orders table, add a composite index on user id and created at, and then check the plan again.",
  },
  { label: "Wraps up", text: "So we cached the results at the edge. Yeah, that's it." },
  { label: "Asks again", text: "Sorry, could you repeat the question?" },
];

const MAX = 4000;

const OUTCOME: Record<TurnDecision, string> = {
  continue: "Arjun keeps listening.",
  end: "Arjun takes it as your full answer and replies.",
  repeat: "Arjun repeats the question.",
  nudge: "Arjun checks in.",
  "give-up": "Arjun moves on.",
  "cut-in": "Arjun politely cuts in.",
};

export function TurnDemo() {
  const [pick, setPick] = useState(0);
  const [quiet, setQuiet] = useState(1200);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const text = SAID[pick].text;

  const at = (quietMs: number) => decideTurn({ transcript: text, quietMs, sinceStartMs: 30_000, nudged: false });
  // The exact silence at which the decision flips, found by asking the real function.
  const threshold = useMemo(() => {
    for (let q = 0; q <= MAX; q += 50) if (decideTurn({ transcript: text, quietMs: q, sinceStartMs: 30_000, nudged: false }) !== "continue") return q;
    return null;
  }, [text]);
  const decision = at(quiet);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function play() {
    cancelAnimationFrame(raf.current);
    setPlaying(true);
    const start = performance.now();
    const step = (now: number) => {
      const q = Math.min(MAX, now - start);
      setQuiet(Math.round(q / 50) * 50);
      if (q < MAX) raf.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
  }

  const pct = (ms: number) => `${(ms / MAX) * 100}%`;

  return (
    <div className="rounded-md border-[1.5px] border-pen/70 bg-paper p-5 sm:p-6">
      <fieldset>
        <legend className="text-sm text-muted">What you just said</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAID.map((s, i) => (
            <label key={s.label} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pen ${i === pick ? "border-pen bg-pen text-paper" : "border-pen/40 text-ink hover:border-pen"}`}>
              <input type="radio" name="said" className="sr-only" checked={i === pick} onChange={() => setPick(i)} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 min-h-[3.5rem] font-display text-lg leading-snug text-pen">&ldquo;{text}&rdquo;</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <label htmlFor="quiet" className="text-muted">
            Silence since your last word
          </label>
          <span className="font-display text-lg font-semibold tabular-nums">{(quiet / 1000).toFixed(1)}s</span>
        </div>
        <div className="relative mt-3 h-8" aria-hidden>
          <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-pen-soft" />
          <div className="absolute left-0 top-3 h-2 rounded-full bg-pen" style={{ width: pct(quiet) }} />
          {threshold !== null && (
            <div className="absolute top-0 h-8 border-l-2 border-dashed border-pencil" style={{ left: pct(threshold) }}>
              <span className="absolute left-1.5 top-[-1.4rem] whitespace-nowrap text-xs text-pencil">replies at {(threshold / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
        <input id="quiet" type="range" min={0} max={MAX} step={50} value={quiet} onChange={(e) => setQuiet(+e.target.value)} className="pen-range mt-1 w-full" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium" aria-live="polite">
          <span className={decision === "continue" ? "text-muted" : "text-pencil"}>{OUTCOME[decision]}</span>
        </p>
        <button type="button" className="btn btn-ghost h-9 px-4 text-sm" onClick={play} disabled={playing}>
          {playing ? "Waiting…" : "Play the silence"}
        </button>
      </div>
    </div>
  );
}
