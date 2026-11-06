import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Snowflake, Wallet, Plus, ArrowRight } from "lucide-react";
import { IncomeCharts } from "@/components/home/income-charts";
import { PeriodPicker } from "@/components/period-picker";
import { RangeAreaChart } from "@/components/range-area-chart";
import { TransactionList } from "@/components/transaction-list";
import { bankSeries } from "@/lib/bank-history";
import type { getDashboard } from "@/lib/dashboard";
import type { getExpensesPage } from "@/lib/expenses";
import { formatMoney, formatPlain, formatSigned, formatPercent } from "@/lib/money";
import "./gpt-home.css";

type Props = { data: Awaited<ReturnType<typeof getDashboard>>; expenses: Awaited<ReturnType<typeof getExpensesPage>> };

export function FeelkyHome({ data, expenses }: Props) {
  const hidden = Boolean(data.settings?.hideAmounts);
  const money = (n: string | number, currency = "USDT") => formatMoney(n, currency, hidden);
  const plain = (n: string | number) => formatPlain(n, hidden);
  const signed = (n: string | number) => formatSigned(n, hidden);
  const uah = (n: string | number) => `≈ ${money(Number(n) * Number(data.rate), "UAH")}`;
  const metrics = [
    { label: "В обороті", value: data.turnover.totalUsdt, icon: RefreshCw, now: true, rows: [{label:"Steam",value:data.turnover.steamUsdt},{label:"Aurum",value:data.turnover.aurumUsdt},{label:"Polymarket",value:data.turnover.polyUsdt}] },
    { label: "Заморожено", value: data.totals.frozenTotalUsdt, icon: Snowflake, now: true, rows: data.totals.frozenBreakdown },
    { label: "Чистий PnL", value: data.totals.periodNetPnlUsdt, icon: Wallet, signed: true, rows: data.totals.pnlBreakdown },
    { label: "Прибуток", value: data.totals.periodProfitUsdt, icon: ArrowUpRight, signed: true, rows: data.totals.profitBreakdown },
    { label: "Мінуси", value: String(-Number(data.totals.periodLossUsdt)), icon: ArrowDownRight, signed: true, rows: data.totals.lossBreakdown },
    { label: "Витрати", value: String(-Number(data.totals.periodSpendUsdt)), icon: ArrowUpRight, signed: true, rows: data.totals.spendBreakdown }
  ];
  const projects = [
    { label: "Фліпи", value: data.projects.flipsUsdt, href: "/flips" },
    { label: "Вилки", value: data.projects.forksUsdt, href: "/forks" },
    { label: "Steam", value: data.projects.steamUsdt, href: "/steam" },
    { label: "Форекс", value: data.projects.fxUsdt, href: "/fx" }
  ];
  const limit = Number(data.settings?.monthlyExpenseLimit?.toString() || 0);
  const personal = Number(expenses.totals.personalUah);
  const ratio = limit > 0 ? personal / limit : 0;
  const maxCategory = Math.max(0, ...expenses.byCategory.map(x => x.value));
  const history = bankSeries(data.bankHistory, "total");
  // This is bank movement, NOT investment return: cash flows and FX are included.
  const change = Number(data.totals.periodBankChangeUsdt);
  const Hero = <section className="gh-panel gh-hero">
    <div className="gh-hero-top"><span className="gh-eyebrow"><span className="gh-live" /> ДОСТУПНИЙ БАНК</span><div className="gh-rate"><span>Курс</span> <b>{formatPlain(data.rate)}</b> <small>UAH / USDT</small></div></div>
    <div className="gh-balance">{plain(data.totals.availableBankUsdt)} <span>USDT</span></div>
    <div className="gh-equivalent">{uah(data.totals.availableBankUsdt)}</div>
    <div className="gh-hero-foot"><span>Вільні гроші · на зараз</span><Link href="/crypto">Гаманець <ArrowUpRight size={15} /></Link></div>
  </section>;
  const Chart = <section className="gh-panel gh-bank-chart"><div className="gh-heading"><div><span className="gh-eyebrow">КАПІТАЛ У ЧАСІ</span><h2>Загальний банк</h2></div><span className={`gh-change ${change >= 0 ? "gh-positive" : "gh-negative"}`}>{signed(change)} <small>USDT · {data.period.label}</small></span></div>
    <p className="gh-muted gh-note">Зміна банку включає рух коштів і курс; це не прибуток.</p>
    <RangeAreaChart data={history} currency="USDT" hidden={hidden} totalLabel="Банк" emptyLabel="Поки немає історії" defaultPreset="period" periodStart={data.period.fromMs} periodEnd={data.period.toMs} periodPhrase={data.period.phrase} minimal smooth />
  </section>;
  const Period = <div className="gh-period"><div><span className="gh-eyebrow">РЕЗУЛЬТАТИ</span><h2>Гроші в деталях</h2></div><PeriodPicker basePath="/overview" period={data.period} presets={["week", "month", "3m", "all"]} /><p className="gh-muted gh-period-note">Оборот і заморожене — на зараз. Результати й проєкти — {data.period.label}.</p></div>;
  const Metrics = <div className="gh-metrics">{metrics.map((m, i) => <section className={`gh-panel gh-metric gh-metric-${i}`} key={m.label}>
    <div className="gh-metric-label"><m.icon size={16} /><h3>{m.label}</h3><small>{m.now ? "зараз" : "період"}</small></div>
    <div className={`gh-metric-number ${m.signed ? Number(m.value) < 0 ? "gh-negative" : "gh-positive" : ""}`}>{m.signed ? signed(m.value) : plain(m.value)}<small>USDT</small></div>
    <p className="gh-muted gh-note">{uah(m.value)}</p>
    <details className="gh-details"><summary>Склад <Plus size={12} /></summary><dl>{m.rows.length ? m.rows.map(r => <div key={r.label}><dt>{r.label}</dt><dd>{plain(r.value)}</dd></div>) : <div className="gh-muted">Немає складових за період</div>}</dl></details>
  </section>)}</div>;
  const Projects = <section className="gh-project-section"><div className="gh-section-title"><h2>Проєкти</h2><span className="gh-muted">Чистий результат · {data.period.label}</span></div><div className="gh-projects">{projects.map((p,i) => <Link href={p.href} key={p.label} className={`gh-project ${Number(p.value) > 0 ? "gh-project-pos" : Number(p.value) < 0 ? "gh-project-neg" : "gh-project-zero"}`}>
    <div className="gh-project-top"><span className="gh-project-id">0{i+1}</span><ArrowUpRight size={17} /></div><h3>{p.label}</h3><div className="gh-project-number">{signed(p.value)}<small>USDT</small></div><p>{uah(p.value)}</p><span className="gh-project-status">{Number(p.value) > 0 ? "Прибуток" : Number(p.value) < 0 ? "Збиток" : "Без результату"}</span>
  </Link>)}</div></section>;
  const Expenses = <section className="gh-panel gh-expenses"><div className="gh-heading"><div><span className="gh-eyebrow">ЦЬОГО МІСЯЦЯ</span><h2>Витрати</h2></div><Link className="gh-text-link" href="/expenses">Усі <ArrowUpRight size={15}/></Link></div>
    <div className="gh-expense-total">{plain(expenses.totals.totalUsdt)} <small>USDT</small></div><p className="gh-muted gh-note">{expenses.period.label} · {money(expenses.totals.dailyAverageUsdt)} / день</p>
    <div className="gh-expense-split"><div><span>Особисті</span><b>{money(personal, "UAH")}</b></div><div><span>Робочі</span><b>{money(expenses.totals.workUsdt)}</b></div></div>
    {limit > 0 ? <div className="gh-budget"><div><span>Особисті · ліміт {money(limit, "UAH")}</span><b className={ratio > 1 ? "gh-negative" : ""}>{formatPercent(ratio * 100, hidden)}</b></div><div className="gh-track"><span className={ratio > 1 ? "gh-over" : ""} style={{width:`${Math.max(0,Math.min(100,ratio*100))}%`}} /></div><p className="gh-muted gh-note">{personal > limit ? "Перевищення" : "Залишилось"}: {money(Math.abs(limit-personal), "UAH")}</p></div> : <p className="gh-muted gh-note">Ліміт особистих витрат не задано</p>}
    <div className="gh-categories">{expenses.byCategory.length ? expenses.byCategory.slice(0,6).map(c => <div className="gh-category" key={c.name}><div><span>{c.name}</span><b>{money(c.value)}</b></div><div className="gh-track"><span style={{width:`${maxCategory > 0 ? c.value/maxCategory*100 : 0}%`}} /></div></div>) : <p className="gh-muted">Цього місяця витрат ще немає</p>}</div>
  </section>;
  const Transactions = <section className="gh-panel gh-transactions"><div className="gh-heading"><div><span className="gh-eyebrow">РУХ КОШТІВ</span><h2>Останні транзакції</h2></div><span className="gh-muted gh-note">Усі типи операцій</span></div><TransactionList items={data.latestTransactions} compact hidden={hidden} /></section>;
  const Actions = <nav className="gh-actions" aria-label="Фінансові розділи"><Link href="/expenses"><Plus size={15} />Витрати</Link><Link href="/income"><ArrowUpRight size={15} />Доходи</Link><Link href="/withdrawals"><RefreshCw size={15} />Перекази</Link><Link href="/flips"><ArrowRight size={15} />Фліпи</Link></nav>;
  const Income = <div className="gh-income"><IncomeCharts data={data} hidden={hidden} /></div>;
  return <div className="gh gh-b"><div className="gh-intro"><div><span className="gh-eyebrow">FEELKY / КОНТРОЛЬ КАПІТАЛУ</span><h1>Усе під контролем.</h1></div><span>01 — Огляд</span></div><div className="gh-bento">{Hero}<div className="gh-bento-chart">{Chart}</div><div className="gh-bento-action">{Actions}<p className="gh-muted gh-note">Капітал зараз — окремо.<br/>Результат періоду — нижче.</p></div></div>{Period}<div className="gh-bento-body"><div className="gh-bento-main">{Metrics}{Projects}</div>{Expenses}</div>{Income}{Transactions}</div>;
}
