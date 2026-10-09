import Decimal from "decimal.js";
import { D } from "@/lib/money";

/**
 * Pure arithmetic behind the Steam wallets: what was brought in ("завоз"), what sits on the
 * wallet now and how the two compare. Kept apart from Prisma so it is unit-testable.
 */

type Money = Decimal.Value | { toString(): string };

const dec = (value: Money) => D(value.toString());

export type WalletInvestment = { externalAmount: Money; receivedSteamAmount: Money };
export type WalletWithdrawal = { softwareAmountSpent: Money; amountReceived: Money };

/**
 * A snapshot says what the wallet showed at one moment. Anything recorded after that moment
 * (a завоз credited, a withdrawal spent) is not in it yet, so it is applied on top.
 */
export function balanceAfterSnapshot(
  snapshotBalance: Money,
  laterInvestments: Array<Pick<WalletInvestment, "receivedSteamAmount">>,
  laterWithdrawals: Array<Pick<WalletWithdrawal, "softwareAmountSpent">>
): Decimal {
  const credited = laterInvestments.reduce((sum, item) => sum.plus(dec(item.receivedSteamAmount)), new Decimal(0));
  const spent = laterWithdrawals.reduce((sum, item) => sum.plus(dec(item.softwareAmountSpent)), new Decimal(0));
  return dec(snapshotBalance).plus(credited).minus(spent);
}

function percentOf(part: Decimal, whole: Decimal): string | null {
  if (whole.lte(0)) return null;
  return part.div(whole).mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toString();
}

export type WalletSummary = {
  /** Real money that went in. */
  investedReal: string;
  /** What arrived on Steam for it. */
  receivedSteam: string;
  /** The extra that "stuck" on the way in, e.g. +30%. */
  bonus: string;
  bonusPercent: string | null;
  withdrawnSteam: string;
  withdrawnReal: string;
  balance: string;
  /** Balance plus what was already taken out, against what came in. */
  difference: string;
  differencePercent: string | null;
};

export function summarizeWallet(input: { balance: Money; investments: WalletInvestment[]; withdrawals: WalletWithdrawal[] }): WalletSummary {
  const investedReal = input.investments.reduce((sum, item) => sum.plus(dec(item.externalAmount)), new Decimal(0));
  const receivedSteam = input.investments.reduce((sum, item) => sum.plus(dec(item.receivedSteamAmount)), new Decimal(0));
  const withdrawnSteam = input.withdrawals.reduce((sum, item) => sum.plus(dec(item.softwareAmountSpent)), new Decimal(0));
  const withdrawnReal = input.withdrawals.reduce((sum, item) => sum.plus(dec(item.amountReceived)), new Decimal(0));
  const balance = dec(input.balance);
  const bonus = receivedSteam.minus(investedReal);
  const difference = balance.plus(withdrawnSteam).minus(receivedSteam);
  return {
    investedReal: investedReal.toString(),
    receivedSteam: receivedSteam.toString(),
    bonus: bonus.toString(),
    bonusPercent: receivedSteam.gt(0) ? percentOf(bonus, investedReal) : null,
    withdrawnSteam: withdrawnSteam.toString(),
    withdrawnReal: withdrawnReal.toString(),
    balance: balance.toString(),
    difference: difference.toString(),
    differencePercent: percentOf(difference, receivedSteam)
  };
}

export function sumSummaries(items: WalletSummary[]): WalletSummary {
  return summarizeWallet({
    balance: items.reduce((sum, item) => sum.plus(item.balance), new Decimal(0)),
    investments: items.map((item) => ({ externalAmount: item.investedReal, receivedSteamAmount: item.receivedSteam })),
    withdrawals: items.map((item) => ({ softwareAmountSpent: item.withdrawnSteam, amountReceived: item.withdrawnReal }))
  });
}

/**
 * What arrived on Steam, typed either as an amount (`887.77`) or as the bonus on top of the
 * real money (`+32%`, `32 %`). Returns a decimal string, or null when it cannot be read.
 */
export function resolveReceivedAmount(text: string, investedReal: Money): string | null {
  const clean = text.trim().replace(/\s+/g, "").replace(",", ".");
  const percent = /^\+?(\d{1,3}(?:\.\d+)?)%$/.exec(clean);
  if (percent) {
    const received = dec(investedReal).mul(new Decimal(percent[1]).div(100).plus(1));
    return received.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString();
  }
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const amount = new Decimal(clean);
  return amount.gt(0) ? amount.toString() : null;
}
