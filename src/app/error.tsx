"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="sheet graph-paper grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo />
        <h1 className="mt-10 font-display text-4xl font-semibold tracking-tight">Something broke on our side</h1>
        <p className="mt-2 text-muted">Your saved interviews are safe.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-ghost">
            Practice log
          </Link>
        </div>
      </div>
    </main>
  );
}
