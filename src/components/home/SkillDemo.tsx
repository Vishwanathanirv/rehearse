"use client";

import { useState } from "react";
import { estimateMastery, type Evidence, type TopicMastery } from "@/lib/interview/mastery";

const ANSWERS = [
  { label: "Strong answer", score: 88 },
  { label: "So-so answer", score: 60 },
  { label: "Weak answer", score: 30 },
];

const STATUS: Record<TopicMastery["status"], string> = {
  weak: "Weak: comes back tomorrow",
  developing: "Still unsure: comes back in 3 days",
  strong: "Strong: comes back in 10 days",
};

export function SkillDemo() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const now = 1_700_000_000_000;
  // One row per answer: the estimate as it stood after that answer, oldest at the top.
  const rows = evidence.map((_, i) => ({ score: evidence[i].score, m: estimateMastery(evidence.slice(0, i + 1), now)[0] }));
  const latest = rows.at(-1)?.m;
  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="rounded-md border-[1.5px] border-pen/70 bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="btn btn-ghost h-9 px-4 text-sm"
            disabled={evidence.length >= 8}
            onClick={() => setEvidence((e) => [...e, { questionId: "fe-perf", score: a.score, at: now - (7 - e.length) * 3_600_000 }])}
          >
            {a.label} ({a.score})
          </button>
        ))}
        {evidence.length > 0 && (
          <button type="button" className="h-9 px-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setEvidence([])}>
            Start over
          </button>
        )}
      </div>

      <div className="relative mt-6 mr-10" role="img" aria-label={latest ? `Estimated skill ${Math.round(latest.mean * 100)}%, likely between ${Math.round(latest.low * 100)}% and ${Math.round(latest.high * 100)}%` : "No answers yet"}>
        {/* The bar a topic must clear to count as strong. */}
        <div className="absolute bottom-0 top-0 border-l-2 border-dashed border-pencil/70" style={{ left: "62%" }} aria-hidden>
          <span className="absolute -top-5 left-1.5 whitespace-nowrap text-xs text-pencil">strong line</span>
        </div>
        <ol className="space-y-2.5 pt-1">
          {rows.length === 0 && (
            <li className="relative h-12">
              <div className="absolute top-3 h-1.5 w-full rounded-full border border-dashed border-pen/40" />
              <span className="absolute left-0 top-6 text-xs text-faint">No answers yet, so it could be anywhere.</span>
            </li>
          )}
          {rows.map(({ score, m }, i) => {
            const last = i === rows.length - 1;
            return (
              <li key={i} className="relative h-7" style={{ opacity: last ? 1 : 0.28 + (0.5 * (i + 1)) / rows.length }}>
                <div className="absolute top-3 h-1.5 rounded-full bg-pen" style={{ left: pct(m.low), width: pct(m.high - m.low) }} />
                <div className="absolute top-[0.45rem] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-paper bg-pen" style={{ left: pct(m.mean) }} />
                <span className="absolute -right-10 top-1 w-8 text-right text-xs tabular-nums text-faint">{score}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex justify-between text-xs text-faint" aria-hidden>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <p className="mt-4 min-h-12 text-[0.95rem]" aria-live="polite">
        {latest ? (
          <>
            <span className="font-medium">
              Somewhere between {Math.round(latest.low * 100)}% and {Math.round(latest.high * 100)}%.
            </span>{" "}
            <span className={latest.status === "weak" ? "text-pencil" : latest.status === "strong" ? "text-pen" : "text-muted"}>{STATUS[latest.status]}.</span>
          </>
        ) : (
          <span className="text-muted">Add a few answers to the same topic and watch the band tighten.</span>
        )}
      </p>
    </div>
  );
}
