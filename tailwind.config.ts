import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        card: "hsl(var(--card))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        danger: "hsl(var(--danger))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))"
      },
      boxShadow: {
        soft: "0 20px 50px -20px rgb(6 10 18 / 0.35), 0 2px 8px rgb(6 10 18 / 0.06)",
        card: "0 1px 2px rgb(6 10 18 / 0.04), 0 8px 24px -16px rgb(6 10 18 / 0.22)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.25), 0 12px 36px -12px hsl(var(--primary) / 0.45)"
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem"
      }
    }
  },
  plugins: []
};

export default config;
