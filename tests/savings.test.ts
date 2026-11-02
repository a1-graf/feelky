import { describe, expect, it } from "vitest";
import { computeJarAccrual, jarProgress } from "@/lib/savings";

describe("savings jars", () => {
  it("accrues ten percent of each positive realised result and ignores losses", () => {
    const result = computeJarAccrual({ fx: ["100", "-40"], poly: ["20", "-5"], flips: ["30"], forks: ["50", "-10"] });
    expect(result.bySource.forks.toString()).toBe("30");
    expect(result.profit.toString()).toBe("180");
    expect(result.target.toString()).toBe("18");
  });

  it("shows the uncovered target and caps progress at one hundred percent", () => {
    expect(jarProgress("100", "35").missing.toString()).toBe("65");
    expect(jarProgress("100", "135").percent.toString()).toBe("100");
  });
});
