export const THEME_COOKIE = "feelky-theme";

export const THEMES = [
  { id: "default", label: "Стандарт", swatch: ["#10b981", "#0f1729"], themeColor: "#252833" },
  { id: "graphite", label: "Графіт", swatch: ["#5edeaf", "#0e0f11"], themeColor: "#0e0f11" },
  { id: "gold", label: "Золото", swatch: ["#d7b670", "#0b0b0b"], themeColor: "#0b0b0b" },
  { id: "matrix", label: "Матриця", swatch: ["#38ff88", "#09120f"], themeColor: "#09120f" },
  { id: "mono", label: "Ч/Б", swatch: ["#121212", "#f4f4f4"], themeColor: "#f4f4f4" }
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function parseTheme(value: string | undefined | null): ThemeId {
  return THEMES.some((theme) => theme.id === value) ? (value as ThemeId) : "default";
}
