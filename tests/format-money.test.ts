import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatPlain, formatSigned, formatSignedPercent } from "@/lib/money";

const nb = (value: string) => value.replace(/ /g, " ");

describe("number display: always 2 decimals", () => {
  it("rounds USDT to 2 decimals instead of 4", () => {
    expect(nb(formatMoney("1538.7271", "USDT"))).toBe("1 538,73 USDT");
    expect(nb(formatMoney(3, "UAH"))).toBe("3,00 UAH");
  });

  it("formats plain, signed and percent values with 2 decimals", () => {
    expect(formatPlain("45.56125")).toBe("45,56");
    expect(formatSigned("1.239")).toBe("+1,24");
    expect(formatSigned("-0.5")).toBe("-0,50");
    expect(formatPercent("12.3456")).toBe("12,35%");
    expect(formatSignedPercent(7)).toBe("+7,00%");
  });

  it("keeps hideAmounts masking", () => {
    expect(formatMoney("12.5", "USDT", true)).toBe("••••");
    expect(formatPlain("12.5", true)).toBe("••••");
    expect(formatSigned("12.5", true)).toBe("••••");
    expect(formatPercent("12.5", true)).toBe("••••");
  });
});
