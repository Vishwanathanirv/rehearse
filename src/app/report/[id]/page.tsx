import { Ruler } from "@/components/log/Ruler";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Bar, ScorePill, ScoreRing } from "@/components/ScoreRing";
import { PrintButton } from "@/components/PrintButton";
import { getSession } from "@/lib/auth/session";
import { finalizeReport, finishInterview, getInterview, NotFoundError } from "@/lib/interview/service";
import { LEVEL_LABELS, ROLE_LABELS, type Level, type Role } from "@/lib/interview/types";

export const metadata = { title: "Report" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let data;
  try {
    data = await getInterview(s.sub, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { interview, turns } = data;
  if (!turns.length) redirect(`/interview/${id}`);
  // Normally the report was finalised when the call ended; if the candidate left early, do it now.
  let report = interview.report;
  if (!report?.final) {
    if (interview.status !== "completed") await finishInterview(s.sub, id);
    report = await finalizeReport(s.sub, id);
  }
  const title = `${LEVEL_LABELS[interview.level as Level]} ${ROLE_LABELS[interview.role as Role]}`;
  const verdictTone = report.verdict === "Strong" ? "bg-good-soft text-good" : report.verdict === "Promising" ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad";

  return (
    <div className="sheet graph-paper min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Interview report</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-muted">
              <span className="capitalize">{interview.focus}</span> · {turns.length} answers ·{" "}
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(interview.createdAt)}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            <Link href="/interview/new" className="btn btn-accent">
              Practise again
            </Link>
          </div>
        </div>

        {report.decision && (
          <section className={`mt-8 rounded-2xl border-l-4 p-6 sm:p-7 ${report.decision.nextRound ? "border-good bg-good-soft/60" : "border-bad bg-bad-soft/60"}`} aria-label="Hiring decision">
            <p className="text-sm text-muted">If this were the real interview, the panel&apos;s call</p>
            <p className={`mt-1 font-display text-3xl font-semibold tracking-tight ${report.decision.nextRound ? "text-good" : "text-bad"}`}>
              {report.decision.call}
              <span className="ml-3 align-middle text-base font-normal text-muted">{report.decision.nextRound ? "You'd move to the next round." : "You wouldn't move forward yet."}</span>
            </p>
            <ul className="mt-4 space-y-1.5 leading-relaxed">
              {report.decision.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="card mt-4 grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={report.overall} />
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${verdictTone}`}>{report.verdict}</span>
          </div>
          <div>
            <p className="text-[1.05rem] leading-relaxed">{report.summary}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Bar label="content" value={report.breakdown.content} />
              <Bar label="depth" value={report.breakdown.depth} />
              <Bar label="structure" value={report.breakdown.structure} />
              <Bar label="delivery" value={report.breakdown.delivery} />
            </div>
            <p className="mt-5 text-xs text-faint">
              {report.source === "ai" ? "Content graded by Gemini. " : "Graded with rule-based scoring. "}Pace, filler words, pitch, pauses and on-camera presence are measured from your answers.
            </p>
          </div>
        </section>

        {report.closing && (
          <section className="card mt-4 p-5 sm:p-6" aria-label="Your questions for the interviewer">
            <h2 className="font-medium">&ldquo;Do you have any questions for me?&rdquo;</h2>
            {report.closing.asked ? (
              <>
                <p className="mt-3 leading-relaxed">
                  <span className="text-muted">You asked: </span>&ldquo;{report.closing.question}&rdquo;
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  &ldquo;{report.closing.reply}&rdquo; <span className="text-faint">— Arjun</span>
                </p>
              </>
            ) : (
              <p className="mt-3 text-muted">You didn&apos;t ask anything.</p>
            )}
            <p className={`mt-3 rounded-xl px-4 py-3 text-sm leading-relaxed ${report.closing.asked ? "bg-surface-2" : "bg-warn-soft text-warn"}`}>{report.closing.note}</p>
          </section>
        )}

        <section aria-labelledby="readings" className="mt-10">
          <h2 id="readings" className="border-b-[1.5px] border-pen/70 pb-2 font-display text-xl font-semibold tracking-tight">
            Readings
          </h2>
          <div className="mt-5 grid gap-8 md:grid-cols-3">
            <Ruler label="Speaking pace" value={report.delivery.avgWpm || null} unit=" wpm" min={0} max={220} band={[120, 160]} note="Target band 120 to 160 words a minute." />
            <Ruler label="Filler words" value={+(report.delivery.fillerRate * 100).toFixed(1)} unit="%" min={0} max={10} band={[0, 2]} note="Under 2% sounds confident." />
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">Words spoken</span>
                <span className="font-mono text-xl font-semibold tabular-nums text-pen">{report.delivery.totalWords}</span>
              </div>
              <p className="mt-3 text-xs text-muted">{report.delivery.totalMinutes ? `About ${report.delivery.totalMinutes} min of speaking.` : "Across all answers."}</p>
            </div>
          </div>
        </section>

        {report.delivery.video && (
          <section className="mt-10 border-t-[1.5px] border-pen/70 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">On camera</h2>
              <span className="text-xs text-faint">Measured with face tracking in your browser, across {report.delivery.video.answers} answer{report.delivery.video.answers === 1 ? "" : "s"}. No video was uploaded or stored.</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div>
                <div className="text-sm text-muted">Eye contact</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.delivery.video.eyeContactPct}%</div>
                <div className="mt-1 text-xs text-faint">Aim for 60% or more; look at the lens on key points</div>
              </div>
              <div>
                <div className="text-sm text-muted">Looked away</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.delivery.video.lookAwaysPerAnswer}×</div>
                <div className="mt-1 text-xs text-faint">Per answer, for a second or more</div>
              </div>
              <div>
                <div className="text-sm text-muted">Smiling</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.delivery.video.smilePct}%</div>
                <div className="mt-1 text-xs text-faint">A natural smile now and then reads as warm</div>
              </div>
              <div>
                <div className="text-sm text-muted">Setup</div>
                <div className="mt-1 font-display text-2xl font-semibold capitalize">{report.delivery.video.framing === "good" && report.delivery.video.lighting === "good" ? "Good" : report.delivery.video.framing !== "good" ? report.delivery.video.framing : report.delivery.video.lighting}</div>
                <div className="mt-1 text-xs text-faint">Head movement {report.delivery.video.movement <= 0.2 ? "calm" : report.delivery.video.movement <= 0.35 ? "moderate" : "high"}</div>
              </div>
            </div>
          </section>
        )}

        {report.delivery.voice && (
          <section className="mt-10 border-t-[1.5px] border-pen/70 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Your voice</h2>
              <span className="text-xs text-faint">Measured from the microphone signal in your browser, across {report.delivery.voice.answers} spoken answer{report.delivery.voice.answers === 1 ? "" : "s"}. No audio was stored.</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-sm text-muted">Pitch variety</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.delivery.voice.pitchSdSemitones != null ? `${report.delivery.voice.pitchSdSemitones} st` : "–"}</div>
                <div className="mt-1 text-xs text-faint">{report.delivery.voice.monotoneAnswers ? `${report.delivery.voice.monotoneAnswers} answer${report.delivery.voice.monotoneAnswers === 1 ? "" : "s"} sounded flat (under 1.6 st)` : "Natural rise and fall: 2 st or more"}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Pauses</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.delivery.voice.pausesPerMinute}/min</div>
                <div className="mt-1 text-xs text-faint">Longest {report.delivery.voice.longestPauseSec} s; short pauses help, long ones read as stuck</div>
              </div>
              <div>
                <div className="text-sm text-muted">Silent time</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{Math.round(report.delivery.voice.pauseRatio * 100)}%</div>
                <div className="mt-1 text-xs text-faint">Of each answer, between your first and last word</div>
              </div>
            </div>
          </section>
        )}

        <section aria-label="Notes" className="mt-10 grid gap-8 border-t-[1.5px] border-pen/70 pt-6 md:grid-cols-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-pen">What worked</h2>
            <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed">
              {report.strengths.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden="true" className="flex-none font-mono text-pen">✓</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-pencil">Work on next</h2>
            <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed">
              {report.improvements.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden="true" className="flex-none font-mono text-pencil">✎</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Study list</h2>
            {report.studyTopics.length ? (
              <ul className="mt-3 space-y-2 text-[0.95rem]">
                {report.studyTopics.map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-1 size-3.5 flex-none border-[1.5px] border-pen" />
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.95rem] text-muted">Nothing technical to revise from this session. Try a harder level next.</p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-tight">Answer by answer</h2>
          <div className="mt-4 space-y-3">
            {turns.map((t, i) => (
              <details key={t.id} className="card group open:shadow-sm" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5">
                  <div>
                    <div className="text-xs text-faint">
                      Q{i + 1} · <span className="capitalize">{t.kind}</span>
                      {t.isFollowUp ? " · follow-up" : ""}
                    </div>
                    <div className="mt-1 font-medium leading-snug">{t.question}</div>
                  </div>
                  <ScorePill score={t.evaluation.score} />
                </summary>
                <div className="border-t border-line px-5 pb-5 pt-4">
                  <blockquote className="rounded-xl bg-surface-2 p-4 text-[0.95rem] leading-relaxed text-muted">{t.answer}</blockquote>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {(["content", "depth", "structure", "delivery"] as const).map((k) => (
                      <Bar key={k} label={k} value={t.evaluation.breakdown[k]} />
                    ))}
                  </div>
                  {t.evaluation.reaction && (
                    <p className="mt-5 text-sm text-muted">&ldquo;{t.evaluation.reaction}&rdquo; <span className="text-faint">— Arjun</span></p>
                  )}
                  {t.evaluation.redFlags?.length ? (
                    <p className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
                      <b>Red flag:</b> {t.evaluation.redFlags.join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-good">Strengths</div>
                      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                        {t.evaluation.strengths.length ? t.evaluation.strengths.map((x) => <li key={x}>{x}</li>) : <li className="text-muted">Nothing stood out in this answer.</li>}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-warn">Improve</div>
                      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                        {t.evaluation.improvements.length ? t.evaluation.improvements.map((x) => <li key={x}>{x}</li>) : <li>Nothing major. Well done.</li>}
                      </ul>
                    </div>
                  </div>
                  {(t.evaluation.covered.length > 0 || t.evaluation.missing.length > 0) && (
                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                      {t.evaluation.covered.map((c) => (
                        <span key={`c-${c}`} className="rounded-full bg-good-soft px-2.5 py-1 text-good">
                          ✓ {c}
                        </span>
                      ))}
                      {t.evaluation.missing.map((c) => (
                        <span key={`m-${c}`} className="rounded-full bg-bad-soft px-2.5 py-1 text-bad">
                          missed {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 text-xs text-faint">
                    {t.evaluation.metrics.words} words
                    {t.evaluation.metrics.wpm ? ` · ${t.evaluation.metrics.wpm} wpm` : ""}
                    {Object.keys(t.evaluation.metrics.fillers).length
                      ? ` · fillers: ${Object.entries(t.evaluation.metrics.fillers)
                          .map(([k, v]) => `${k} ×${v}`)
                          .join(", ")}`
                      : " · no filler words"}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
