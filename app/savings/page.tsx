import { BackToOverview } from "@/components/back-to-overview";
import { PageTitle } from "@/components/page-title";
import { TransactionList } from "@/components/transaction-list";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getSavingsOverview } from "@/lib/savings";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Jar = Awaited<ReturnType<typeof getSavingsOverview>>["jars"][number];

function JarCard({ jar, hidden }: { jar: Jar; hidden: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary/15 via-card to-success/10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-semibold text-primary">Банка</div><h2 className="mt-1 text-2xl font-bold">{jar.name}</h2></div>
          <div className="rounded-full bg-background/70 px-3 py-1 text-xs font-semibold tabular-nums">10,00% прибутку</div>
        </div>
        <div className="mt-5 text-3xl font-bold tabular-nums text-success">{formatMoney(jar.balanceUah, "UAH", hidden)}</div>
        <div className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">≈ {formatMoney(jar.balanceUsdt, "USDT", hidden)} зараз у банці</div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, jar.progress))}%` }} /></div>
        <div className="mt-2 flex justify-between gap-3 text-xs text-[hsl(var(--card-muted-foreground))]">
          <span>Покрито {hidden ? "••••" : `${jar.progress.toFixed(2)}%`}</span><span>Ціль {formatMoney(jar.targetUsdt, "USDT", hidden)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-card p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Не вистачає</div><div className="mt-1 font-bold tabular-nums text-danger">{formatMoney(jar.missingUsdt, "USDT", hidden)}</div></div>
        <div className="bg-card p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Забирали раніше</div><div className="mt-1 font-bold tabular-nums">{formatMoney(jar.withdrawnUah, "UAH", hidden)}</div></div>
        <div className="col-span-2 bg-card p-4"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Внесено переказами</div><div className="mt-1 font-semibold tabular-nums">{formatMoney(jar.depositedUah, "UAH", hidden)}</div></div>
      </div>
    </Card>
  );
}

export default async function SavingsPage() {
  const userId = await requireUserId();
  const data = await getSavingsOverview(userId);
  return (
    <>
      <BackToOverview />
      <PageTitle title="Відкладення" subtitle="Дві незалежні банки: кожна накопичує ціль 10,00% від позитивного результату маркетів" />
      <Card className="mb-4 border-primary/25 bg-primary/5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div><div className="text-sm font-semibold">Як рахується</div><p className="mt-1 text-sm text-[hsl(var(--card-muted-foreground))]">У кожну банку нараховується 10,00% від кожної прибуткової закритої угоди Forex, Polymarket і фліпів, а для вилок — від частки після комісії Багіри. Збитки ціль не зменшують.</p></div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-card p-3"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Позитивний прибуток</div><div className="mt-1 font-bold">{formatMoney(data.profitUsdt, "USDT", data.hidden)}</div></div>
            <div className="rounded-lg bg-card p-3"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">Ціль кожної банки</div><div className="mt-1 font-bold text-primary">{formatMoney(data.targetPerJarUsdt, "USDT", data.hidden)}</div></div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">{data.jars.map((jar) => <JarCard key={jar.name} jar={jar} hidden={data.hidden} />)}</div>
      <Card className="mt-4">
        <div className="mb-3 font-semibold">Склад цілі</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([["Forex", data.bySource.fx], ["Polymarket", data.bySource.poly], ["Фліпи", data.bySource.flips], ["Вилки · нам", data.bySource.forks]] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted p-3"><div className="text-xs text-[hsl(var(--card-muted-foreground))]">{label}</div><div className="mt-1 font-semibold tabular-nums">{formatMoney(value, "USDT", data.hidden)}</div></div>
          ))}
        </div>
        <div className="mt-3 text-xs text-[hsl(var(--card-muted-foreground))]">«Не вистачає» = нарахована ціль мінус поточний баланс банки. Курс для UAH: {Number(data.rate).toFixed(2)} UAH/USDT. Автоматичний розрахунок не створює переказів і не рухає гроші без вашої дії.</div>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {data.jars.map((jar) => <Card key={`${jar.name}-history`}><div className="mb-3 font-semibold">Історія · {jar.name}</div><TransactionList items={jar.transactions.slice(0, 8)} /></Card>)}
      </div>
    </>
  );
}
