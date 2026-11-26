# Rehearse

Voice mock interviewer. Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Drizzle on Postgres (PGlite when `DATABASE_URL` is unset), Zod, jose, optional Gemini.

## Commands
- `npm run dev` · `npm run build`
- `npm run lint && npm run typecheck && npm test` before every commit
- `npm run test:e2e` (Playwright, fake microphone)

## Layout
- `src/app` pages and route handlers (`api/*`)
- `src/lib/interview` bank, rules grader, planner, Gemini adapter, service
- `src/lib/auth` scrypt, JWT cookie · `src/lib/db` schema and connection
- `src/lib/voice`, `src/lib/video` on-device DSP and face tracking
- `tests/unit`, `tests/e2e`

## Rules
- One dark theme. No italics. No "How it works", "Try it", onboarding modals or login wall: guest sessions start instantly.
- Every state-changing route: session check, ownership check, Zod input, `rateLimit`, Origin check.
- AI calls always time out and fall back to the rules grader.
- Audio and video never leave the browser; only text and summary numbers are sent.
- No personal details or repo links in code, UI or metadata.
