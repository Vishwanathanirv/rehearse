/** Placeholder lines shaped like the page that is loading. */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <main aria-busy="true" aria-label="Loading" className="sheet graph-paper min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 pt-24 sm:px-6">
        <div className="h-9 w-64 animate-pulse rounded bg-pen-soft" />
        <div className="mt-10 h-48 animate-pulse rounded bg-pen-soft/60" />
        <div className="mt-12 space-y-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-pen-soft/50" style={{ width: `${90 - i * 9}%` }} />
          ))}
        </div>
      </div>
    </main>
  );
}
