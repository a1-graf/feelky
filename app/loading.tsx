export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-40 rounded-lg bg-muted" />
      <div className="mt-2.5 h-4 w-64 max-w-full rounded bg-muted/70" />

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-28 rounded-2xl border border-border/60 bg-card/70 p-4 sm:min-h-32">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="mt-4 h-6 w-24 rounded bg-muted" />
            <div className="mt-3 h-3 w-12 rounded bg-muted/70" />
          </div>
        ))}
      </div>

      <div className="mt-4 h-52 rounded-2xl border border-border/60 bg-card/70" />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 rounded-2xl border border-border/60 bg-card/70" />
        ))}
      </div>
    </div>
  );
}
