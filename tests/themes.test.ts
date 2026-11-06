import { describe, expect, it } from "vitest";
import { THEMES, parseTheme } from "@/lib/themes";

describe("themes", () => {
  it("offers white, black and matrix", () => {
    expect(THEMES.map((theme) => theme.id)).toEqual(["white", "black", "matrix"]);
  });

  it("maps saved old themes onto the new white and black", () => {
    expect(parseTheme("minimal")).toBe("white");
    expect(parseTheme("graphite")).toBe("black");
    expect(parseTheme("mono")).toBe("white");
    expect(parseTheme("gold")).toBe("black");
    expect(parseTheme("matrix")).toBe("matrix");
    expect(parseTheme(undefined)).toBe("white");
  });
});
