import { NetPnlChart } from "@/components/income-line-chart";
import { Card } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/lib/money";

type FlipSetup = { setup: string; pnl: string; count: number; wins: number; losses: number; winRate: number };
type RecentFlip = { id: string; setup: string; pnl: string; tradeDate: string; note: string | null };
type Timeline = { date: string; label: string; profit: number; loss: number; net: number };
type FlipsData = {
  totalPnl: string; monthPnl: string; count: number; wins: number; losses: number; winRate: number;
  avgPnl: string; best: { setup: string; pnl: string } | null; worst: { setup: string; pnl: string } | null;
  timeline: Timeline[]; setups: FlipSetup[]; recent: RecentFlip[];
};
const tone = (value: string) => Number(value) > 0 ? "text-success" : Number(value) < 0 ? "text-danger" : "";

export function FlipsStatistics({ data, allTimePnl, periodLabel, hidden = false }: { data: FlipsData; allTimePnl: string; periodLabel: string; hidden?: boolean }) {
  const setupByName = new Map(data.setups.map((setup) => [setup.setup, setup]));
  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="font-semibold">Результат за період</div><div className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">{periodLabel} · лише закриті фліпи</div></div>
          <div className="text-right"><div className={`text-2xl font-bold ${tone(data.totalPnl)}`}>{formatMoney(data.totalPnl, "USDT", hidden)}</div><div className="text-xs text-[hsl(var(--card-muted-foreground))]">{data.count} угод</div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            ["Весь час", formatMoney(allTimePnl, "USDT", hidden), tone(allTimePnl)],
            ["Winrate", hidden ? "••••" : formatPercent(data.winRate), ""],
            ["Середній PnL", formatMoney(data.avgPnl, "USDT", hidden), tone(data.avgPnl)],
            ["Плюс / мінус", hidden ? "••••" : `${data.wins} / ${data.losses}`, ""]
          ].map(([label, value, className]) => <div key={label} className="rounded-lg bg-muted p-3"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div><div className={`mt-1 font-semibold ${className}`}>{value}</div></div>)}
        </div>
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/50 p-3 text-xs text-[hsl(var(--card-muted-foreground))]">Активні позиції, ROI та час утримання не показуються: поточна модель фліпа зберігає тільки закритий PnL, дату й сетап. Feelky нічого не домислює без собівартості та часу входу.</div>
      </Card>

      <Card className="mt-4"><div className="mb-1 font-semibold">PnL у часі</div><div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Денний результат і накопичений підсумок вибраного періоду</div><NetPnlChart data={data.timeline} hidden={hidden} currency="USDT" /></Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 font-semibold">Сетапи</div>
          <div className="grid gap-2">
            {data.setups.map((setup) => <div key={setup.setup} className="rounded-lg bg-muted p-3 text-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{setup.setup}</div><div className="text-xs text-[hsl(var(--card-muted-foreground))]">{setup.count} угод · winrate {hidden ? "••••" : formatPercent(setup.winRate)}</div></div><div className={`shrink-0 font-semibold ${tone(setup.pnl)}`}>{formatMoney(setup.pnl, "USDT", hidden)}</div></div></div>)}
            {!data.setups.length && <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">За період фліпів немає</div>}
          </div>
        </Card>
        <Card>
          <div className="mb-3 font-semibold">Останні закриті фліпи</div>
          <div className="grid gap-2">
            {data.recent.map((flip) => {
              const setup = setupByName.get(flip.setup);
              return <div key={flip.id} className="rounded-lg bg-muted p-3 text-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{flip.setup}</div><div className="text-xs text-[hsl(var(--card-muted-foreground))]">{new Date(flip.tradeDate).toLocaleDateString("uk-UA")}{setup ? ` · сетап ${setup.count}×` : ""}</div></div><div className={`shrink-0 font-semibold ${tone(flip.pnl)}`}>{formatMoney(flip.pnl, "USDT", hidden)}</div></div>{flip.note && <div className="mt-2 text-xs text-[hsl(var(--card-muted-foreground))]">{flip.note}</div>}</div>;
            })}
            {!data.recent.length && <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">За період фліпів немає</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
