import { describe, expect, it } from "vitest";
import { steamBalanceInputSchema } from "@/lib/steam-input";
import { balanceAfterSnapshot, resolveReceivedAmount, summarizeWallet, sumSummaries } from "@/lib/steam-wallet-math";

describe("Steam wallet summary", () => {
  const wallet = summarizeWallet({
    balance: "935.56",
    investments: [{ externalAmount: "600", receivedSteamAmount: "887.77" }],
    withdrawals: []
  });

  it("shows what came in against what sits there now", () => {
    expect(wallet.investedReal).toBe("600");
    expect(wallet.receivedSteam).toBe("887.77");
    expect(wallet.bonus).toBe("287.77");
    expect(wallet.bonusPercent).toBe("48");
    expect(wallet.difference).toBe("47.79");
    expect(wallet.differencePercent).toBe("5.4");
  });

  it("counts money already taken out as part of the result", () => {
    const withdrawn = summarizeWallet({
      balance: "100",
      investments: [{ externalAmount: "600", receivedSteamAmount: "800" }],
      withdrawals: [{ softwareAmountSpent: "750", amountReceived: "540" }]
    });
    expect(withdrawn.difference).toBe("50");
    expect(withdrawn.withdrawnReal).toBe("540");
  });

  it("has no bonus while nothing has arrived yet", () => {
    const pending = summarizeWallet({ balance: "0", investments: [{ externalAmount: "300", receivedSteamAmount: "0" }], withdrawals: [] });
    expect(pending.bonusPercent).toBeNull();
    expect(pending.differencePercent).toBeNull();
  });

  it("adds two wallets together", () => {
    const second = summarizeWallet({ balance: "64.44", investments: [{ externalAmount: "100", receivedSteamAmount: "132.23" }], withdrawals: [] });
    const total = sumSummaries([wallet, second]);
    expect(total.balance).toBe("1000");
    expect(total.investedReal).toBe("700");
    expect(total.receivedSteam).toBe("1020");
  });
});

describe("balance after a snapshot", () => {
  it("keeps a завоз recorded after the moment the balance was read", () => {
    expect(balanceAfterSnapshot("900", [{ receivedSteamAmount: "130" }], [{ softwareAmountSpent: "30" }]).toString()).toBe("1000");
    expect(balanceAfterSnapshot("900", [], []).toString()).toBe("900");
  });
});

describe("what arrived on Steam", () => {
  it("reads a plain amount", () => {
    expect(resolveReceivedAmount("790", "600")).toBe("790");
    expect(resolveReceivedAmount("1 250,50", "1000")).toBe("1250.5");
  });

  it("reads the bonus as a percent of the real money", () => {
    expect(resolveReceivedAmount("+32%", "600")).toBe("792");
    expect(resolveReceivedAmount("35 %", "100")).toBe("135");
    expect(resolveReceivedAmount("30,5%", "200")).toBe("261");
  });

  it("rejects anything else", () => {
    expect(resolveReceivedAmount("багато", "600")).toBeNull();
    expect(resolveReceivedAmount("0", "600")).toBeNull();
    expect(resolveReceivedAmount("-5", "600")).toBeNull();
  });
});

describe("agent Steam balance input", () => {
  it("accepts a balance as a string or a number", () => {
    expect(steamBalanceInputSchema.parse({ account: "1пп", balance: "935.56" }).balance).toBe("935.56");
    expect(steamBalanceInputSchema.parse({ account: "1пп", balance: 12.5, currency: "$" }).currency).toBe("USD");
  });

  it("refuses negative balances, hryvnias and stale or future times", () => {
    expect(steamBalanceInputSchema.safeParse({ account: "1пп", balance: "-1" }).success).toBe(false);
    expect(steamBalanceInputSchema.safeParse({ account: "1пп", balance: "10", currency: "UAH" }).success).toBe(false);
    expect(steamBalanceInputSchema.safeParse({ account: "1пп", balance: "10", observedAt: new Date(Date.now() + 3_600_000).toISOString() }).success).toBe(false);
    expect(steamBalanceInputSchema.safeParse({ account: "1пп", balance: "10", observedAt: "2020-01-01T00:00:00Z" }).success).toBe(false);
    expect(steamBalanceInputSchema.safeParse({ account: "", balance: "10" }).success).toBe(false);
  });
});
