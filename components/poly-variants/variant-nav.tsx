import Link from "next/link";

export const POLY_VARIANTS = [
  { href: "/poly", label: "Зараз", title: "Поточна сторінка" },
  { href: "/poly/v1", label: "1", title: "Мінімум: результат, банк, графік" },
  { href: "/poly/v2", label: "2", title: "По джерелах угод" },
  { href: "/poly/v3", label: "3", title: "Журнал угод" },
  { href: "/poly/v4", label: "4", title: "Ризики" },
  { href: "/poly/v5", label: "5", title: "Гаманці: внесено і зараз" }
] as const;

/** Quiet switcher between the current Polymarket page and the five trial layouts. */
export function PolyVariantNav({ current }: { current: string }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-[hsl(var(--card-muted-foreground))]" aria-label="Варіанти сторінки Polymarket">
      <span className="mr-1">Варіант:</span>
      {POLY_VARIANTS.map((variant) => (
        <Link
          key={variant.href}
          href={variant.href}
          title={variant.title}
          className={`rounded-md px-2 py-1 ${variant.href === current ? "bg-muted font-semibold text-foreground" : "hover:bg-muted"}`}
        >
          {variant.label}
        </Link>
      ))}
    </nav>
  );
}
