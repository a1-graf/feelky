import { describe, expect, it } from "vitest";
import { limitColor } from "@/lib/limit-color";

const hue = (color: string) => Number(/hsl\(([\d.]+)/.exec(color)![1]);

describe("limitColor", () => {
  it("is green when little is spent and light green around 30%", () => {
    expect(limitColor(0)).toBe("hsl(145 62% 36%)");
    expect(limitColor(0.3)).toBe("hsl(100 68% 54%)");
  });

  it("goes amber at the limit and saturated red from 140%", () => {
    expect(limitColor(1)).toBe("hsl(36 96% 52%)");
    expect(limitColor(1.4)).toBe("hsl(0 84% 48%)");
    expect(limitColor(3)).toBe("hsl(0 84% 48%)");
  });

  it("moves smoothly: the hue only falls as spending grows", () => {
    let previous = Infinity;
    for (let ratio = 0; ratio <= 1.6; ratio += 0.05) {
      const current = hue(limitColor(ratio));
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it("treats junk as zero", () => {
    expect(limitColor(NaN)).toBe(limitColor(0));
    expect(limitColor(-1)).toBe(limitColor(0));
  });
});
