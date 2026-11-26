import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ScoreLog } from "@/components/log/ScoreLog";
import { getSession } from "@/lib/auth/session";
import { PracticeButton } from "@/components/PracticeButton";
import { practicePlan, type TopicMastery } from "@/lib/interview/mastery";
import { HIRE_BAR } from "@/lib/interview/planner";
import { getMastery, listInterviews } from "@/lib/interview/service";
import { LEVEL_LABELS, ROLE_LABELS, type Level, type Role } from "@/lib/interview/types";

export const metadata = { title: "Practice log" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * The practice log: a page of the same graph-paper notebook as the home page. Scores are plotted
 * in ink against the hiring bar in red pencil, skills are drawn as measurements with error bars,
 * and every session is a ruled entry. No stat cards.
 */
export default async function Dashboard() {
  const s = await getSession();
  if (!s) redirect("/login");
  const [rows, mastery] = await Promise.all([listInterviews(s.sub), getMastery(s.sub)]);
  const latest = rows[0];
  const plan = latest ? practicePlan(mastery.topics, { role: latest.role as Role }) : [];
  const done = rows.filter((r) => r.status === "completed" && r.overallScore !== null).reverse();
  const points = done.map((r) => ({ id: r.id, score: Math.round(r.overallScore!), role: r.role as Role, level: r.level as Level, at: r.createdAt }));
  const scores = points.map((p) => p.score);
  const best = scores.length ? Math.max(...scores) : null;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const trend = scores.length >= 2 ? scores.at(-1)! - scores[0] : null;
  const cleared = points.filter((p) => p.score >= HIRE_BAR[p.level]).length;

  return (
    <div className="sheet graph-paper min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Practice log</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-pen">
              {s.guest ? "Your practice log" : `Hi ${s.name.split(" ")[0]}, here's your log.`}
            </h1>
          </div>
          <Link href="/interview/new" className="btn btn-accent">
            Start a new interview
          </Link>
        </div>

        {s.guest && (
          <p className="pencil-note mt-5 max-w-xl text-[0.8rem] leading-relaxed">
            ✎ Guest log: it is tied to this browser. <Link href="/signup" className="underline underline-offset-4">Create an account</Link> to keep it on any device.
          </p>
        )}

        <section aria-labelledby="scores" className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b-[1.5px] border-pen/70 pb-2">
            <h2 id="scores" className="font-display text-xl font-semibold tracking-tight">
              Scores against the bar
            </h2>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
              <Reading k="Interviews completed" v={String(done.length)} />
              <Reading k="Average" v={avg !== null ? String(avg) : "–"} />
              <Reading k="Best" v={best !== null ? String(best) : "–"} />
              <Reading k="Cleared the bar" v={`${cleared}/${done.length}`} />
            </dl>
          </div>
          {points.length ? (
            <div className="mt-5">
              <ScoreLog points={points} />
              {trend !== null && (
                <p className="pencil-note mt-3">
                  {trend > 0 ? `↑ ${trend} points since your first interview.` : trend < 0 ? `↓ ${-trend} points since your first interview.` : "Level with your first interview."}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-5 py-6 md:grid-cols-[1fr_auto] md:items-center">
              <p className="max-w-lg leading-relaxed text-muted">
                Nothing plotted yet. Each interview you finish becomes a point on this page, measured against the bar a hiring panel would hold you to. The first takes about ten minutes, out loud.
              </p>
              <Link href="/interview/new" className="btn btn-primary justify-self-start">
                Start your first interview
              </Link>
            </div>
          )}
        </section>

        {mastery.topics.length > 0 && (
          <section aria-labelledby="skills" className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-pen/70 pb-2">
              <div>
                <h2 id="skills" className="font-display text-xl font-semibold tracking-tight">
                  Skill map
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">
                  Measured from all {mastery.answers} of your answers. The tick is the best estimate and the whisker is how sure it is; it narrows as you practise. A topic counts as strong only when the whole whisker clears the red line.
                </p>
              </div>
              {latest && plan.length > 0 && <PracticeButton role={latest.role as Role} level={latest.level as Level} topics={plan.map((p) => p.topic)} />}
            </div>
            {plan.length > 0 && <p className="pencil-note mt-3">Next up: {plan.map((p) => p.topic).join(", ")}</p>}
            <ul className="ruled mt-2">
              {mastery.topics.map((t) => (
                <SkillRow key={t.topic} t={t} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="history" className="mt-14">
          <h2 id="history" className="border-b-[1.5px] border-pen/70 pb-2 font-display text-xl font-semibold tracking-tight">
            Entries
          </h2>
          {rows.length === 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-4"><p className="text-sm text-muted">No entries yet. Your first interview takes about ten minutes.</p><Link href="/interview/new" className="btn btn-accent">Start an interview</Link></div>
          ) : (
            <ol className="ruled">
              {rows.map((r) => {
                const scored = r.status === "completed" && r.overallScore !== null;
                const score = scored ? Math.round(r.overallScore!) : null;
                const bar = HIRE_BAR[r.level as Level];
                return (
                  <li key={r.id}>
                    <Link
                      href={r.status === "completed" ? `/report/${r.id}` : `/interview/${r.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-3.5 hover:bg-pen-soft/40 sm:grid-cols-[9rem_1fr_auto]"
                    >
                      <span className="col-span-2 font-mono text-xs text-muted sm:col-span-1">{fmt.format(r.createdAt)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{ROLE_LABELS[r.role as Role]}</span>
                        <span className="block text-sm text-muted">
                          {LEVEL_LABELS[r.level as Level]} · <span className="capitalize">{r.focus}</span>
                        </span>
                      </span>
                      {score !== null ? (
                        <span className="text-right font-mono tabular-nums">
                          <span className={`text-lg font-semibold ${score >= bar ? "text-pen" : "text-pencil"}`}>{score}</span>
                          <span className="text-xs text-muted"> / bar {bar}</span>
                        </span>
                      ) : (
                        <span className="pencil-note">unfinished · resume →</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function Reading({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="font-semibold text-pen">{v}</dd>
    </div>
  );
}

const STATUS: Record<TopicMastery["status"], string> = { weak: "needs work", developing: "developing", strong: "strong" };
const STRONG_LINE = 62;

function SkillRow({ t }: { t: TopicMastery }) {
  const tone = t.status === "weak" ? "text-pencil" : t.status === "strong" ? "text-pen" : "text-muted";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,14rem)_1fr_6.5rem]">
      <div className="min-w-0">
        <div className="truncate font-medium">{t.topic}</div>
        <div className="font-mono text-[0.7rem] text-muted">
          {t.kind === "behavioral" ? "behavioural" : "technical"} · n={t.answers}
          {t.due ? " · due for review" : ""}
        </div>
      </div>
      <span className={`font-mono text-xs sm:order-last sm:text-right ${tone}`}>{STATUS[t.status]}</span>
      <div className="relative col-span-2 h-6 sm:col-span-1" role="img" aria-label={`${t.topic}: about ${Math.round(t.mean * 100)}%, likely between ${Math.round(t.low * 100)} and ${Math.round(t.high * 100)}`}>
        <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: "var(--grid-major)" }} />
        <div className="absolute inset-y-1 w-0 border-l-[1.5px] border-dashed border-pencil" style={{ left: `${STRONG_LINE}%` }} />
        <div className="absolute top-1/2 h-0 border-t-2 border-pen" style={{ left: `${t.low * 100}%`, width: `${(t.high - t.low) * 100}%` }} />
        <div className="absolute inset-y-1.5 w-0 border-l-2 border-pen" style={{ left: `${t.low * 100}%` }} />
        <div className="absolute inset-y-1.5 w-0 border-l-2 border-pen" style={{ left: `${t.high * 100}%` }} />
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-pen bg-paper" style={{ left: `${t.mean * 100}%` }} />
      </div>
    </li>
  );
}
