export const THEME_COOKIE = "feelky-theme";

/** The themes in the picker: white, black and the green "code" one. */
export const THEMES = [
  { id: "minimal", label: "Біла", swatch: ["#b87a1f", "#fafaf7"], themeColor: "#f3f2ec" },
  { id: "graphite", label: "Чорна", swatch: ["#5edeaf", "#0e0f11"], themeColor: "#0e0f11" },
  { id: "matrix", label: "Матриця", swatch: ["#38ff88", "#09120f"], themeColor: "#09120f" }
] as const;

/**
 * ARCHIVE (06.11.2026): themes taken out of the picker. Their CSS is still in app/globals.css
 * (:root/.dark for "default", html[data-theme="gold"|"mono"]); to bring one back, move it into THEMES.
 */
export const ARCHIVED_THEMES = [
  { id: "default", label: "Стандарт", swatch: ["#10b981", "#0f1729"], themeColor: "#252833" },
  { id: "gold", label: "Золото", swatch: ["#d7b670", "#0b0b0b"], themeColor: "#0b0b0b" },
  { id: "mono", label: "Ч/Б", swatch: ["#121212", "#f4f4f4"], themeColor: "#f4f4f4" }
] as const;

// A cookie left from an archived theme lands on the closest one that is still offered.
const LEGACY: Record<string, ThemeId> = { default: "minimal", mono: "minimal", gold: "graphite" };

export type ThemeId = (typeof THEMES)[number]["id"];

export function parseTheme(value: string | undefined | null): ThemeId {
  if (THEMES.some((theme) => theme.id === value)) return value as ThemeId;
  return (value && LEGACY[value]) || "minimal";
}
