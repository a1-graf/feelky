"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, THEME_COOKIE, parseTheme, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/ui";

function currentTheme(): ThemeId {
  return parseTheme(document.documentElement.dataset.theme);
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === "default") delete root.dataset.theme;
  else root.dataset.theme = id;
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  const color = THEMES.find((item) => item.id === id)?.themeColor;
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

function useTheme() {
  const [theme, setTheme] = useState<ThemeId>("default");
  useEffect(() => setTheme(currentTheme()), []);
  const choose = (id: ThemeId) => {
    applyTheme(id);
    setTheme(id);
  };
  return { theme, choose };
}

function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/20"
      style={{ background: `linear-gradient(135deg, ${colors[1]} 50%, ${colors[0]} 50%)` }}
    />
  );
}

/** A row of theme dots with labels: the settings page and the desktop sidebar. */
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, choose } = useTheme();
  return (
    <div role="radiogroup" aria-label="Тема" className={cn("grid gap-1", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-5")}>
      {THEMES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={theme === item.id}
          title={item.label}
          onClick={() => choose(item.id)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium transition-colors",
            theme === item.id ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          )}
        >
          <Swatch colors={item.swatch} />
          {compact ? null : <span>{item.label}</span>}
        </button>
      ))}
    </div>
  );
}

/** Palette button for the mobile header that opens a small theme menu. */
export function ThemeMenuButton() {
  const { theme, choose } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Тема оформлення"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 bg-card text-primary shadow-sm transition-colors active:bg-muted"
      >
        <Palette className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                choose(item.id);
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm text-foreground hover:bg-muted/70"
            >
              <Swatch colors={item.swatch} />
              <span className="flex-1">{item.label}</span>
              {theme === item.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
