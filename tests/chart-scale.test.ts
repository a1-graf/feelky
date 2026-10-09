import { describe, expect, it } from "vitest";
import { calendarDays, dayLabel, niceScale, shortAxisValue } from "@/lib/chart-scale";

describe("niceScale", () => {
  it("uses round steps that include zero", () => {
    expect(niceScale([-71.8, 86.5])).toEqual({ domain: [-100, 100], ticks: [-100, -50, 0, 50, 100] });
    expect(niceScale([-164.5, -33.2])).toEqual({ domain: [-200, 0], ticks: [-200, -150, -100, -50, 0] });
    expect(niceScale([1200, 4300]).ticks).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
  });

  it("copes with an all-zero series", () => {
    expect(niceScale([0, 0])).toEqual({ domain: [-1, 1], ticks: [0] });
  });
});

describe("calendarDays", () => {
  it("fills the quiet days between the period bounds", () => {
    expect(calendarDays(["2026-10-03", "2026-10-01"], "2026-10-01", "2026-10-05")).toEqual([
      "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"
    ]);
  });

  it("widens the range to data outside the bounds and crosses months", () => {
    expect(calendarDays(["2026-09-30"], "2026-10-01", "2026-10-01")).toEqual(["2026-09-30", "2026-10-01"]);
  });

  it("keeps only active days when the range is too long", () => {
    expect(calendarDays(["2026-01-01", "2026-12-31"])).toEqual(["2026-01-01", "2026-12-31"]);
  });
});

describe("labels", () => {
  it("formats days and axis values briefly", () => {
    expect(dayLabel("2026-10-09")).toBe("09.10");
    expect(shortAxisValue(150)).toBe("150");
    expect(shortAxisValue(-1500)).toBe("-1,5k");
  });
});
