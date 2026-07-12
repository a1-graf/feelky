export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[244px_1fr]">
      <aside className="hidden border-r border-border bg-card p-4 md:block">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 grid gap-3">
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
        <div className="mt-6 h-36 animate-pulse rounded-lg border border-border bg-card" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </main>
    </div>
  );
}
