import { describe, expect, it } from "vitest";
import { chartPresetFor, resolvePeriod } from "@/lib/period";

const now = new Date(2026, 9, 22, 15, 0, 0);

describe("resolvePeriod", () => {
  it("defaults to the current calendar month", () => {
    const period = resolvePeriod({}, now);
    expect(period.key).toBe("month");
    expect(period.from).toEqual(new Date(2026, 9, 1));
    expect(period.month).toBeNull();
  });

  it("covers the last 7 days for the week preset", () => {
    expect(resolvePeriod({ period: "week" }, now).from).toEqual(new Date(2026, 9, 16));
  });

  it("picks one whole past month", () => {
    const period = resolvePeriod({ month: "2026-09" }, now);
    expect(period.key).toBe("custom");
    expect(period.from).toEqual(new Date(2026, 8, 1));
    expect(period.to.getMonth()).toBe(8);
    expect(period.to.getDate()).toBe(30);
  });

  it("falls back to the current month for a future or invalid month", () => {
    expect(resolvePeriod({ month: "2027-01" }, now).key).toBe("month");
    expect(resolvePeriod({ month: "2026-13" }, now).key).toBe("month");
  });

  it("maps periods to chart presets", () => {
    expect(chartPresetFor("12m")).toBe("1y");
    expect(chartPresetFor("custom")).toBe("all");
  });
});
