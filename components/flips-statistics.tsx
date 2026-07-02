import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

type FlipSetup = {
  setup: string;
  pnl: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
};

type RecentFlip = {
  id: string;
  setup: string;
  pnl: string;
  tradeDate: string;
  note: string | null;
};

type FlipsData = {
  totalPnl: string;
  monthPnl: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  setups: FlipSetup[];
  recent: RecentFlip[];
};

export function FlipsStatistics({ data, hidden = false }: { data: FlipsData; hidden?: boolean }) {
  const setupByName = new Map(data.setups.map((setup) => [setup.setup, setup]));

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Фліпи</div>
          <div className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">PnL по сетапах спекуляцій</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-semibold ${Number(data.totalPnl) >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(data.totalPnl, "USDT", hidden)}
          </div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">загальний PnL</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">PnL місяця</div>
          <div className={`mt-1 font-semibold ${Number(data.monthPnl) >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(data.monthPnl, "USDT", hidden)}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">Winrate</div>
          <div className="mt-1 font-semibold">{hidden ? "****" : `${data.winRate}%`}</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">Плюсових</div>
          <div className="mt-1 font-semibold text-success">{hidden ? "****" : data.wins}</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">Мінусових</div>
          <div className="mt-1 font-semibold text-danger">{hidden ? "****" : data.losses}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold">Сетапи та останні фліпи</div>
        <div className="grid gap-2">
          {data.recent.length ? data.recent.map((flip) => {
            const setup = setupByName.get(flip.setup);
            return (
              <div key={flip.id} className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{flip.setup}</div>
                    <div className="text-xs text-[hsl(var(--card-muted-foreground))]">{new Date(flip.tradeDate).toLocaleDateString("uk-UA")}</div>
                  </div>
                  <div className={`shrink-0 font-semibold ${Number(flip.pnl) >= 0 ? "text-success" : "text-danger"}`}>
                    {formatMoney(flip.pnl, "USDT", hidden)}
                  </div>
                </div>
                {setup ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--card-muted-foreground))]">
                    <span>{setup.count} записів</span>
                    <span>winrate {setup.winRate}%</span>
                    <span>сетап PnL: <b className={Number(setup.pnl) >= 0 ? "text-success" : "text-danger"}>{formatMoney(setup.pnl, "USDT", hidden)}</b></span>
                  </div>
                ) : null}
                {flip.note ? <div className="mt-2 text-xs text-[hsl(var(--card-muted-foreground))]">{flip.note}</div> : null}
              </div>
            );
          }) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає фліпів</div>
          )}
        </div>
      </div>
    </Card>
  );
}
