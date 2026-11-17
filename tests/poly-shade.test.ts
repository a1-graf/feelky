import { describe, expect, it } from "vitest";
import { polyDays } from "@/lib/poly-calendar";
import {
  SHADE_STEPS,
  shadeColor,
  shadeStep,
  shadeTextDark,
} from "@/lib/poly-shade";

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
        expect(lightness(shadeColor(step, profit))).toBeGreaterThan(
          lightness(shadeColor(step - 1, profit)),
        );
      }
    }
    expect(shadeColor(5, true).startsWith("hsl(142")).toBe(true);
    expect(shadeColor(5, false).startsWith("hsl(0")).toBe(true);
  });
});

describe("polyDays", () => {
  it("sums closed trades per Kyiv day of their result and skips open ones", () => {
    const days = polyDays([
      {
        status: "WON",
        pnlUsd: "9.53",
        openedAt: "2026-10-20T10:00:00.000Z",
        resolvedAt: "2026-10-20T10:05:00.000Z",
      },
      {
        status: "LOST",
        pnlUsd: "-3",
        openedAt: "2026-10-20T20:55:00.000Z",
        resolvedAt: "2026-10-20T21:10:00.000Z",
      },
      {
        status: "OPEN",
        pnlUsd: "99",
        openedAt: "2026-10-21T10:00:00.000Z",
        resolvedAt: null,
      },
    ]);
    // 21:10Z is already 21 October in Kyiv (UTC+3).
    expect(days).toEqual([
      { date: "2026-10-20", pnl: "9.53", count: 1 },
      { date: "2026-10-21", pnl: "-3", count: 1 },
    ]);
  });

  it("keeps cents unrounded so tiny days still add up", () => {
    const days = polyDays([
      {
        status: "WON",
        pnlUsd: "0.0049",
        openedAt: "2026-10-20T10:00:00.000Z",
        resolvedAt: "2026-10-20T10:05:00.000Z",
      },
      {
        status: "WON",
        pnlUsd: "0.0049",
        openedAt: "2026-10-21T10:00:00.000Z",
        resolvedAt: "2026-10-21T10:05:00.000Z",
      },
    ]);
    expect(days.reduce((sum, day) => sum + Number(day.pnl), 0)).toBeCloseTo(
      0.0098,
      6,
    );
  });

  it("falls back to the open time, and follows the Kyiv winter offset", () => {
    const days = polyDays([
      {
        status: "LOST",
        pnlUsd: "-1",
        openedAt: "2026-12-31T22:30:00.000Z",
        resolvedAt: null,
      },
    ]);
    // 22:30Z in winter is 00:30 on 1 January in Kyiv (UTC+2).
    expect(days).toEqual([{ date: "2027-01-01", pnl: "-1", count: 1 }]);
  });
});

function contrast(color: string, dark: boolean): number {
  const [h, sat, light] = color.match(/\d+/g)!.map(Number);
  const s = sat / 100;
  const l = light / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
  return dark ? (lum + 0.05) / 0.05 : 1.05 / (lum + 0.05);
}

describe("shadeTextDark", () => {
  it("gives the digits at least 4.5:1 contrast on every shade", () => {
    for (const profit of [true, false]) {
      for (let step = 1; step <= SHADE_STEPS; step++) {
        expect(
          contrast(shadeColor(step, profit), shadeTextDark(step, profit)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
