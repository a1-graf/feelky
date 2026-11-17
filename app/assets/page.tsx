import { createAssetAction, deleteAssetAction, revalueAssetAction, updateAssetAction } from "@/app/assets/actions";
import { ActionForm } from "@/components/action-form";
import { BackToOverview } from "@/components/back-to-overview";
import { NetCapitalCard } from "@/components/net-capital-card";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { ASSET_CATEGORIES, listAssets, type AssetView } from "@/lib/assets";
import { getDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { kyivToday } from "@/lib/telegram/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric" });
const submitClass = "min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground";

function CategoryOptions({ id }: { id: string }) {
  return <datalist id={id}>{ASSET_CATEGORIES.map((name) => <option key={name} value={name} />)}</datalist>;
}

function AssetCard({ asset, hidden }: { asset: AssetView; hidden: boolean }) {
  return (
    <Card className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-primary">{asset.category}</div>
          <div className="truncate text-lg font-bold">{asset.name}</div>
          <div className="text-xs text-[hsl(var(--card-muted-foreground))]">оцінка від {dateFormat.format(asset.valuedAt)}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">{formatMoney(asset.value, asset.currency, hidden)}</div>
          {asset.currency !== "USDT" && <div className="text-xs text-[hsl(var(--card-muted-foreground))]">≈ {formatMoney(asset.valueUsdt, "USDT", hidden)}</div>}
        </div>
      </div>
      {asset.note && <div className="text-sm text-[hsl(var(--card-muted-foreground))]">{asset.note}</div>}
      {asset.history.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[hsl(var(--card-muted-foreground))]">Історія оцінок ({asset.history.length})</summary>
          <ul className="mt-2 grid gap-1">
            {asset.history.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5">
                <span>{dateFormat.format(item.valuedAt)}{item.note ? ` · ${item.note}` : ""}</span>
                <span className="font-semibold tabular-nums">{formatMoney(item.value, item.currency, hidden)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <ActionForm action={revalueAssetAction} className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-[1.2fr_0.8fr_1fr_auto] sm:items-end">
        <input type="hidden" name="assetId" value={asset.id} />
        <label>Нова оцінка<input name="value" inputMode="decimal" required placeholder="0,00" /></label>
        <label>Валюта
          <select name="currency" defaultValue={asset.currency}><option>USD</option><option>USDT</option><option>UAH</option></select>
        </label>
        <label className="col-span-2 sm:col-span-1">Дата<input type="date" name="date" defaultValue={kyivToday()} max={kyivToday()} /></label>
        <button className={`${submitClass} col-span-2 sm:col-span-1`} type="submit">Оцінити</button>
      </ActionForm>
      <details className="text-sm">
        <summary className="cursor-pointer text-[hsl(var(--card-muted-foreground))]">Змінити назву, категорію, нотатку</summary>
        <ActionForm action={updateAssetAction} resetOnSuccess={false} className="mt-2 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <label>Назва<input name="name" defaultValue={asset.name} maxLength={80} required /></label>
          <label>Категорія<input name="category" defaultValue={asset.category} list={`categories-${asset.id}`} maxLength={80} /><CategoryOptions id={`categories-${asset.id}`} /></label>
          <label className="sm:col-span-2">Нотатка<input name="note" defaultValue={asset.note ?? ""} maxLength={200} /></label>
          <button className={`${submitClass} sm:col-span-2`} type="submit">Зберегти</button>
        </ActionForm>
      </details>
      <ActionForm action={deleteAssetAction} confirmText={`Прибрати «${asset.name}» з майна? Історія оцінок лишиться в архіві бази.`} className="flex justify-end">
        <input type="hidden" name="assetId" value={asset.id} />
        <button type="submit" className="text-xs font-medium text-[hsl(var(--card-muted-foreground))] underline-offset-2 hover:text-danger hover:underline">Видалити</button>
      </ActionForm>
    </Card>
  );
}

export default async function AssetsPage() {
  const userId = await requireUserId();
  const dashboard = await getDashboard(userId, { period: "month" });
  const data = await listAssets(userId, dashboard.rate);
  const hidden = Boolean(dashboard.settings?.hideAmounts);

  return (
    <>
      <BackToOverview />
      <PageTitle title="Майно" subtitle="Речі, які мають вартість. Рахуються лише в чистому капіталі — не в банку, доходах чи витратах" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-4">
          <Card className="border-primary/30 bg-primary/10 p-4">
            <div className="text-xs font-medium text-primary">Майно разом</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatMoney(data.totals.totalUsdt, "USDT", hidden)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.totals.byCategory.map((item) => (
                <span key={item.name} className="rounded-md bg-card/70 px-2 py-1 text-xs">{item.name}: <b className="tabular-nums">{formatMoney(item.valueUsdt, "USDT", hidden)}</b></span>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-1 font-semibold">Додати річ</div>
            <div className="mb-3 text-sm text-[hsl(var(--card-muted-foreground))]">Оцінка — за скільки реально продати зараз. Її можна оновлювати, історія зберігається.</div>
            <ActionForm action={createAssetAction} className="grid gap-3 sm:grid-cols-2">
              <label>Назва<input name="name" required maxLength={80} placeholder="Машина" /></label>
              <label>Категорія<input name="category" list="categories-new" maxLength={80} placeholder="Транспорт" /><CategoryOptions id="categories-new" /></label>
              <label>Оцінка<input name="value" inputMode="decimal" required placeholder="5 000,00" /></label>
              <label>Валюта
                <select name="currency" defaultValue="USD"><option>USD</option><option>USDT</option><option>UAH</option></select>
              </label>
              <label>Дата оцінки<input type="date" name="date" defaultValue={kyivToday()} max={kyivToday()} /></label>
              <label>Нотатка<input name="note" maxLength={200} placeholder="Рік, стан" /></label>
              <button className={`${submitClass} sm:col-span-2`} type="submit">Додати</button>
            </ActionForm>
          </Card>

          <section className="grid gap-3">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Речі</h2><span className="rounded-md bg-muted px-2 py-1 text-xs">{data.totals.count}</span></div>
            {data.assets.length ? data.assets.map((asset) => <AssetCard key={asset.id} asset={asset} hidden={hidden} />) : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Поки нічого не додано</div>}
          </section>
        </div>
        <div className="grid content-start gap-4">
          <NetCapitalCard totals={dashboard.totals} hidden={hidden} rate={dashboard.rate} />
        </div>
      </div>
    </>
  );
}
