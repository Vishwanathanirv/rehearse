import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { GuestButton } from "@/components/GuestButton";
import { HonestDemo } from "@/components/home/HonestDemo";
import { SkillDemo } from "@/components/home/SkillDemo";
import { TurnDemo } from "@/components/home/TurnDemo";
import { VoiceStrip } from "@/components/home/VoiceStrip";
import { Warmup } from "@/components/home/Warmup";
import { getSession } from "@/lib/auth/session";

/**
 * The home page is the product's own instruments, running live: the pitch tracker, the
 * turn-taking rule, the skill estimate and the red-flag check are the same code that runs
 * during an interview, not illustrations of it.
 */
const ROWS = [
  {
    title: "He waits until you're actually done.",
    body: "There's no answer button to press. Arjun listens for silence, and how long he waits depends on what you've said: a short answer gets 2.5 seconds in case you're still thinking, a long one gets less. Say “that's it” and he replies right away. Ask him to repeat and he will.",
    demo: <TurnDemo />,
  },
  {
    title: "One good answer doesn't prove you know it.",
    body: "Each topic keeps a running estimate of your skill with an honest range around it. Lucky once? The range stays wide. Consistent? It tightens. A topic only counts as strong when even the low end of the range clears the line, and weak topics come back sooner.",
    demo: <SkillDemo />,
  },
  {
    title: "He tells you what a real interviewer would think.",
    body: "Before grading what you said, Arjun checks how you said it. Lying in bed, joking around, or giving up gets called out first, because in a real interview that's what ends it.",
    demo: <HonestDemo />,
  },
];

export default async function Home() {
  const signedIn = Boolean(await getSession());
  return (
    <div className="graph-paper min-h-screen [--accent-ink:var(--paper)] [--accent:var(--pen)] [--bg:var(--paper)] [--ring:color-mix(in_oklab,var(--pen)_40%,transparent)]">
      <AppHeader />
      <Warmup />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 md:pt-20">
          <h1 className="max-w-[16ch] font-display text-[clamp(2.5rem,6.4vw,4.75rem)] font-semibold leading-[1] tracking-[-0.035em] text-pen">Hear how you sound before they do.</h1>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="max-w-[36rem] text-lg leading-relaxed text-muted">
              Rehearse is a mock interviewer that talks with you, waits when you pause, and tells you honestly how it went. The line below is a voice drawn by the same pitch tracker that measures your answers.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <GuestButton signedIn={signedIn}>Start an interview</GuestButton>
              {signedIn ? (
                <Link href="/dashboard" className="btn btn-ghost">
                  Your dashboard
                </Link>
              ) : (
                <Link href="/signup" className="btn btn-ghost">
                  Create a free account
                </Link>
              )}
            </div>
          </div>

          <div className="mt-12">
            <VoiceStrip />
          </div>
        </section>

        {ROWS.map((r) => (
          <section key={r.title} className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-14 sm:px-6 md:grid-cols-[0.8fr_1fr] md:gap-14">
            <div className="md:pt-4">
              <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.1] tracking-[-0.02em]">{r.title}</h2>
              <p className="mt-4 max-w-[30rem] leading-relaxed text-muted">{r.body}</p>
            </div>
            {r.demo}
          </section>
        ))}


        <section className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
          <div className="flex flex-col gap-6 border-t-[1.5px] border-pen/70 pt-10 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[30rem] font-display text-2xl font-semibold leading-snug tracking-[-0.02em]">Ten minutes, out loud, with someone who won&rsquo;t go easy on you.</p>
            <GuestButton signedIn={signedIn}>Start practising now</GuestButton>
          </div>
          <p className="mt-6 text-sm text-faint">Voice only, like a real interview. Use Chrome or Edge on a computer.</p>
        </section>
      </main>
    </div>
  );
}
