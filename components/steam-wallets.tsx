"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { formatMoney, formatSignedPercent } from "@/lib/money";
import { LOSS_COLOR, PROFIT_COLOR } from "@/lib/chart-colors";

export type SteamWalletView = {
  id: string;
  name: string;
  balance: string;
  investedReal: string;
  receivedSteam: string;
  bonusPercent: string | null;
  withdrawnSteam: string;
  withdrawnReal: string;
  difference: string;
  differencePercent: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  history: Array<{ at: string; balance: number }>;
};

const updatedFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

function signed(value: string, currency: string) {
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${formatMoney(value, currency)}`;
}

function percent(value: string | null) {
  if (value === null) return null;
  const number = Number(value);
  return formatSignedPercent(number);
}

function Row({ label, value, detail, tone }: { label: string; value: string; detail?: string | null; tone?: "ok" | "danger" }) {
  const color = tone === "ok" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-[hsl(var(--card-muted-foreground))]">{label}</span>
      <span className={`text-right font-medium tabular-nums ${color}`}>
        {value}
        {detail ? <span className="ml-1.5 text-xs font-normal text-[hsl(var(--card-muted-foreground))]">{detail}</span> : null}
      </span>
    </div>
  );
}

function Sparkline({ points, color }: { points: SteamWalletView["history"]; color: string }) {
  if (points.length < 2) return null;
  return (
    <div className="mt-3 h-12 w-full">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="linear" dataKey="balance" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One card per Steam account: what sits on the wallet now against what was brought in. */
export function SteamWallets({ wallets }: { wallets: SteamWalletView[] }) {
  if (!wallets.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-[hsl(var(--card-muted-foreground))]">
        Ще немає Steam акаунтів. Додай їх нижче, у вкладці «Перепродаж».
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {wallets.map((wallet) => {
        const difference = Number(wallet.difference);
        const hasIncome = Number(wallet.receivedSteam) > 0;
        return (
          <div key={wallet.id} className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{wallet.name}</div>
                <div className="mt-0.5 text-xs text-[hsl(var(--card-muted-foreground))]">
                  {wallet.updatedAt ? `оновлено ${updatedFormatter.format(new Date(wallet.updatedAt))} · ${wallet.updatedBy}` : "баланс ще не оновлювали"}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--card-muted-foreground))]">Steam</span>
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-[hsl(var(--card-muted-foreground))]">Зараз на Steam</div>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(wallet.balance, "USD")}</div>
            <Sparkline points={wallet.history} color={difference >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
            <div className="mt-3 divide-y divide-border border-t border-border">
              <Row label="Завезено" value={formatMoney(wallet.investedReal, "USDT")} />
              <Row label="Зайшло на Steam" value={formatMoney(wallet.receivedSteam, "USD")} detail={percent(wallet.bonusPercent)} />
              {Number(wallet.withdrawnSteam) > 0 ? (
                <Row label="Виведено" value={formatMoney(wallet.withdrawnReal, "USDT")} detail={`з ${formatMoney(wallet.withdrawnSteam, "USD")}`} />
              ) : null}
              {hasIncome ? (
                <Row
                  label="Різниця з тим, що зайшло"
                  value={signed(wallet.difference, "USD")}
                  detail={percent(wallet.differencePercent)}
                  tone={difference > 0 ? "ok" : difference < 0 ? "danger" : undefined}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
