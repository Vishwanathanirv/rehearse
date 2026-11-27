"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Starts practising straight away. A visitor gets a guest session first; someone already signed
 * in goes straight to the setup page, keeping their account (and their history).
 */
export function GuestButton({ className = "btn btn-accent", children = "Start an interview", signedIn = false }: { className?: string; children?: React.ReactNode; signedIn?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Signed in: load the setup page ahead of the click, so the jump is instant. (Not for visitors:
  // before the guest session exists, the prefetched page would be the sign-in redirect.)
  useEffect(() => {
    if (signedIn) router.prefetch("/interview/new");
  }, [router, signedIn]);
  // A page restored from the back-forward cache must not come back stuck on "Starting…".
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    // The error sits under the button without taking space, so nothing next to it moves.
    <span className={`relative ${className.includes("w-full") ? "flex w-full" : "inline-flex"} flex-col`}>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          if (signedIn) {
            router.push("/interview/new");
            return;
          }
          try {
            const res = await fetch("/api/auth/guest", { method: "POST" });
            if (res.ok) {
              router.push("/interview/new");
              router.refresh();
              return;
            }
            setError((await res.json().catch(() => ({}))).error ?? "Could not start a guest session.");
          } catch {
            setError("No connection. Check your network and try again.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Starting…" : children}
      </button>
      {error && (
        <span role="alert" className={`text-sm text-bad ${className.includes("w-full") ? "mt-1" : "absolute left-0 top-full mt-1.5 whitespace-nowrap"}`}>
          {error}
        </span>
      )}
    </span>
  );
}
