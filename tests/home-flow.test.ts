import { describe, expect, it } from "vitest";
import { buildHomeFlow, incomeGroup } from "@/lib/home-flow";

const d = (day: string) => new Date(`${day}T10:00:00.000Z`);

describe("home flow", () => {
  it("nets each direction per day: plus goes to income, minus to costs, expenses by category", () => {
    const flow = buildHomeFlow(
      [
        { date: d("2026-11-01"), net: "10", kind: "flip", source: "Фліпи" },
        { date: d("2026-11-01"), net: "-4", kind: "flip", source: "Фліпи" },
        { date: d("2026-11-01"), net: "-3", kind: "fx", source: "Aurum (Forex)" },
        { date: d("2026-11-03"), net: "-5", kind: "expense", source: "", category: "Їжа" },
        { date: d("2026-11-03"), net: "7.5", kind: "fork", source: "Вилки" },
        { date: d("2026-11-03"), net: "20", kind: "income", source: "Зарплата" }
      ],
      { from: "2026-11-01", to: "2026-11-04" }
    );
    expect(flow.series.map((p) => [p.date, p.income, p.costs])).toEqual([
      ["2026-11-01", 6, 3],
      ["2026-11-02", 0, 0],
      ["2026-11-03", 27.5, 5],
      ["2026-11-04", 0, 0]
    ]);
    expect(flow.income).toEqual([
      { name: "Фліпи", value: 6 },
      { name: "Вилки", value: 7.5 },
      { name: "Ручні доходи", value: 20 }
    ]);
    expect(flow.costs).toEqual([
      { name: "Їжа", value: 5 },
      { name: "Мінуси", value: 3 }
    ]);
    expect(flow.incomeTotal).toBe(33.5);
    expect(flow.costsTotal).toBe(8);
  });

  it("is empty without events and maps sources to slices", () => {
    expect(buildHomeFlow([]).series).toEqual([]);
    expect(incomeGroup({ kind: "income", source: "Steam арбітраж" })).toBe("Steam");
    expect(incomeGroup({ kind: "poly", source: "Polymarket" })).toBe("Polymarket");
  });
});
