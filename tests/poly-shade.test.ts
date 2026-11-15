import { describe, expect, it } from "vitest";
import { polyDays } from "@/lib/poly-calendar";
import { SHADE_STEPS, shadeColor, shadeStep } from "@/lib/poly-shade";

describe("shadeStep", () => {
  it("is 0 for a flat day and one step per 50 USD up to 500", () => {
    expect(shadeStep(0)).toBe(0);
    expect(shadeStep(0.001)).toBe(0);
    expect(shadeStep(0.01)).toBe(1);
    expect(shadeStep(50)).toBe(1);
    expect(shadeStep(50.01)).toBe(2);
    expect(shadeStep(-52.85)).toBe(2);
    expect(shadeStep(450)).toBe(9);
    expect(shadeStep(450.01)).toBe(10);
    expect(shadeStep(500)).toBe(10);
    expect(shadeStep(-12000)).toBe(SHADE_STEPS);
  });

  it("gets brighter with every step and keeps the hue", () => {
    const lightness = (color: string) => Number(color.match(/(\d+)%\)$/)![1]);
    for (const profit of [true, false]) {
      for (let step = 2; step <= SHADE_STEPS; step++) {
        expect(lightness(shadeColor(step, profit))).toBeGreaterThan(lightness(shadeColor(step - 1, profit)));
      }
    }
    expect(shadeColor(5, true).startsWith("hsl(142")).toBe(true);
    expect(shadeColor(5, false).startsWith("hsl(0")).toBe(true);
  });
});

describe("polyDays", () => {
  it("sums closed trades per Kyiv day of their result and skips open ones", () => {
    const days = polyDays([
      { status: "WON", pnlUsd: "9.53", openedAt: "2026-10-20T10:00:00.000Z", resolvedAt: "2026-10-20T10:05:00.000Z" },
      { status: "LOST", pnlUsd: "-3", openedAt: "2026-10-20T20:55:00.000Z", resolvedAt: "2026-10-20T21:10:00.000Z" },
      { status: "OPEN", pnlUsd: "99", openedAt: "2026-10-21T10:00:00.000Z", resolvedAt: null }
    ]);
    // 21:10Z is already 22 October in Kyiv (UTC+3).
    expect(days).toEqual([
      { date: "2026-10-20", pnl: "9.53", count: 1 },
      { date: "2026-10-21", pnl: "-3", count: 1 }
    ]);
  });
});
