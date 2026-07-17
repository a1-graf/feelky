"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp
} from "lightweight-charts";
import { formatMoney } from "@/lib/money";

type BalancePoint = {
  date: string;
  label: string;
  tooltipLabel?: string;
  eventIndex?: number;
  full: number;
  available: number;
};

type HoverInfo = {
  x: number;
  y: number;
  date: string;
  full: string;
  available: string;
  fullChange: string;
  availableChange: string;
};

const ranges = [
  { label: "7д", days: 7 },
  { label: "1м", days: 30 },
  { label: "3м", days: 90 },
  { label: "6м", days: 180 },
  { label: "12м", days: 365 },
  { label: "Все", days: null }
];

function seriesValue(value: unknown) {
  if (!value || typeof value !== "object" || !("value" in value)) return null;
  const amount = (value as { value?: unknown }).value;
  return typeof amount === "number" ? amount : null;
}

function timeLabel(time: Time) {
  if (typeof time === "number") {
    return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(time * 1000));
  }
  if (typeof time === "string") return time;
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(time.year, time.month - 1, time.day))
  );
}

function changeFromCurrent(current: number, point: number, hidden: boolean) {
  if (hidden) return "••••";
  const delta = current - point;
  const percent = point === 0 ? null : (delta / Math.abs(point)) * 100;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const money = formatMoney(Math.abs(delta), "USDT", false);
  const percentText = percent == null ? "" : ` · ${sign}${Math.abs(percent).toFixed(1)}%`;
  return `${sign}${money}${percentText}`;
}

export function BalanceGrowthChart({ data, rate, hidden = false }: { data: BalancePoint[]; rate: string; hidden?: boolean }) {
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const fullSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const availableSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const uahRate = Number(rate);
  const currentPoint = useMemo(() => {
    return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).at(-1) || null;
  }, [data]);

  const visibleData = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!rangeDays || sorted.length <= 1) return sorted;

    const endDate = new Date();
    const cutoff = new Date(endDate);
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const firstInRangeIndex = sorted.findIndex((point) => new Date(point.date).getTime() >= cutoff.getTime());

    if (firstInRangeIndex === 0) return sorted;
    if (firstInRangeIndex === -1) {
      const previous = sorted[sorted.length - 1];
      return [
        { ...previous, date: cutoff.toISOString(), label: "Старт", tooltipLabel: "Початок періоду", eventIndex: 0 },
        { ...previous, date: endDate.toISOString(), label: "Зараз", tooltipLabel: "Зараз", eventIndex: 1 }
      ];
    }

    const previous = sorted[firstInRangeIndex - 1];
    return [
      { ...previous, date: cutoff.toISOString(), label: "Старт", tooltipLabel: "Початок періоду", eventIndex: 0 },
      ...sorted.slice(firstInRangeIndex)
    ];
  }, [data, rangeDays]);

  const chartData = useMemo(() => {
    let previousTime = 0;
    return visibleData.map((point) => {
      const sourceTime = Math.floor(new Date(point.date).getTime() / 1000);
      const time = Math.max(sourceTime, previousTime + 1) as UTCTimestamp;
      previousTime = time;
      return { time, full: point.full, available: point.available };
    });
  }, [visibleData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const styles = getComputedStyle(container);
    const cssColor = (name: string, fallback: string) => {
      const value = styles.getPropertyValue(name).trim();
      return value ? `hsl(${value})` : fallback;
    };
    const card = cssColor("--card", "#171a21");
    const foreground = cssColor("--card-foreground", "#f1eee8");
    const muted = cssColor("--card-muted-foreground", "#aaa69e");
    const border = cssColor("--border", "#343946");
    const priceFormatter = (value: number) => hidden ? "****" : new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value);

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: card },
        textColor: muted,
        fontFamily: styles.fontFamily,
        fontSize: 12
      },
      grid: {
        vertLines: { color: border, style: 1 },
        horzLines: { color: border, style: 1 }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: muted, labelBackgroundColor: foreground },
        horzLine: { color: muted, labelBackgroundColor: foreground }
      },
      leftPriceScale: {
        visible: true,
        borderColor: border,
        scaleMargins: { top: 0.24, bottom: 0.24 }
      },
      rightPriceScale: { visible: false },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: 18,
        minBarSpacing: 2,
        lockVisibleTimeRangeOnResize: true
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true }
      },
      kineticScroll: { mouse: true, touch: true },
      localization: { locale: "uk-UA", priceFormatter }
    });

    const fullSeries = chart.addSeries(LineSeries, {
      title: "Повний",
      priceScaleId: "left",
      color: "#2563eb",
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      priceFormat: { type: "custom", formatter: priceFormatter, minMove: 0.0001 }
    });
    const availableSeries = chart.addSeries(LineSeries, {
      title: "Доступний + в обороті",
      priceScaleId: "left",
      color: "#16a34a",
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      priceFormat: { type: "custom", formatter: priceFormatter, minMove: 0.0001 }
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.time == null || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHover(null);
        return;
      }
      const full = seriesValue(param.seriesData.get(fullSeries));
      const available = seriesValue(param.seriesData.get(availableSeries));
      if (full == null || available == null) {
        setHover(null);
        return;
      }
      const width = container.clientWidth;
      const height = container.clientHeight;
      setHover({
        x: Math.max(8, Math.min(param.point.x + 14, width - 260)),
        y: Math.max(8, Math.min(param.point.y + 14, height - 156)),
        date: timeLabel(param.time),
        full: `${formatMoney(full, "USDT", hidden)} · ${formatMoney(full * uahRate, "UAH", hidden)}`,
        available: `${formatMoney(available, "USDT", hidden)} · ${formatMoney(available * uahRate, "UAH", hidden)}`,
        fullChange: currentPoint ? changeFromCurrent(currentPoint.full, full, hidden) : "",
        availableChange: currentPoint ? changeFromCurrent(currentPoint.available, available, hidden) : ""
      });
    });

    chartRef.current = chart;
    fullSeriesRef.current = fullSeries;
    availableSeriesRef.current = availableSeries;
    return () => {
      setHover(null);
      fullSeriesRef.current = null;
      availableSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [currentPoint, hidden, uahRate]);

  useEffect(() => {
    const chart = chartRef.current;
    const fullSeries = fullSeriesRef.current;
    const availableSeries = availableSeriesRef.current;
    if (!chart || !fullSeries || !availableSeries) return;
    fullSeries.setData(chartData.map((point) => ({ time: point.time, value: point.full })));
    availableSeries.setData(chartData.map((point) => ({ time: point.time, value: point.available })));
    chart.timeScale().fitContent();
  }, [chartData]);

  if (!data.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає даних</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 bg-[#2563eb]" />Повний</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 bg-[#16a34a]" />Доступний + в обороті</span>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-border bg-muted p-1">
          {ranges.map((range) => (
            <button
              key={range.label}
              type="button"
              className={`min-h-8 rounded-md px-3 text-xs font-semibold transition ${rangeDays === range.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"}`}
              onClick={() => setRangeDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[420px] min-h-[320px] w-full overflow-hidden rounded-md border border-border bg-card">
        <div ref={containerRef} className="absolute inset-0" />
        {hover && (
          <div className="pointer-events-none absolute z-10 w-[250px] rounded-md border border-border bg-card p-3 text-xs shadow-soft" style={{ left: hover.x, top: hover.y }}>
            <div className="mb-2 font-semibold text-[hsl(var(--card-foreground))]">{hover.date}</div>
            <div className="text-[#2563eb]">Повний: {hover.full}</div>
            <div className="mt-0.5 text-[#2563eb] opacity-80">Зараз від цієї точки: {hover.fullChange}</div>
            <div className="mt-1 text-[#16a34a]">Доступний: {hover.available}</div>
            <div className="mt-0.5 text-[#16a34a] opacity-80">Зараз від цієї точки: {hover.availableChange}</div>
          </div>
        )}
      </div>
    </div>
  );
}
