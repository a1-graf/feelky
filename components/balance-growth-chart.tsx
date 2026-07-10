"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

type BalancePoint = {
  date: string;
  label: string;
  tooltipLabel?: string;
  eventIndex?: number;
  full: number;
  available: number;
};

const ranges = [
  { label: "7д", days: 7 },
  { label: "1м", days: 30 },
  { label: "3м", days: 90 },
  { label: "6м", days: 180 },
  { label: "12м", days: 365 },
  { label: "Все", days: null }
];

export function BalanceGrowthChart({ data, rate, hidden = false }: { data: BalancePoint[]; rate: string; hidden?: boolean }) {
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [viewRange, setViewRange] = useState({ startIndex: 0, endIndex: Number.MAX_SAFE_INTEGER });
  const dragRef = useRef<{ startX: number; startIndex: number; endIndex: number; width: number } | null>(null);
  const uahRate = Number(rate);
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
  const boundedRange = useMemo(() => {
    const lastIndex = Math.max(0, visibleData.length - 1);
    const startIndex = Math.max(0, Math.min(viewRange.startIndex, lastIndex));
    const endIndex = Math.max(startIndex, Math.min(viewRange.endIndex, lastIndex));
    return { startIndex, endIndex };
  }, [viewRange, visibleData.length]);
  const zoomedData = useMemo(
    () => visibleData.slice(boundedRange.startIndex, boundedRange.endIndex + 1),
    [visibleData, boundedRange]
  );
  const visibleStartDate = visibleData[0]?.date;
  const visibleEndDate = visibleData[visibleData.length - 1]?.date;
  useEffect(() => {
    setViewRange({ startIndex: 0, endIndex: Math.max(0, visibleData.length - 1) });
  }, [rangeDays, data.length, visibleData.length, visibleStartDate, visibleEndDate]);
  const yDomain = useMemo<[number, number]>(() => {
    const values = zoomedData.flatMap((point) => [point.full, point.available]).filter(Number.isFinite);
    if (!values.length) return [0, 1000];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const observedSpan = maximum - minimum;
    const padding = Math.max(600, maximum * 0.55, observedSpan * 0.8);
    const roughMinimum = Math.max(0, minimum - padding);
    const roughMaximum = maximum + padding;
    const rounding = roughMaximum >= 10000 ? 1000 : roughMaximum >= 2000 ? 500 : 100;
    return [
      Math.max(0, Math.floor(roughMinimum / rounding) * rounding),
      Math.ceil(roughMaximum / rounding) * rounding
    ];
  }, [zoomedData]);

  if (!data.length) {
    return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[hsl(var(--card-muted-foreground))]">Поки немає даних</div>;
  }

  const showDots = zoomedData.length <= 120;
  const selectedSize = boundedRange.endIndex - boundedRange.startIndex + 1;

  function setWindowSize(nextSize: number, anchorRatio = 0.5) {
    const total = visibleData.length;
    if (!total) return;
    const minimumSize = Math.min(3, total);
    const size = Math.max(minimumSize, Math.min(total, nextSize));
    const anchor = boundedRange.startIndex + (selectedSize - 1) * anchorRatio;
    let startIndex = Math.round(anchor - (size - 1) * anchorRatio);
    startIndex = Math.max(0, Math.min(startIndex, total - size));
    setViewRange({ startIndex, endIndex: startIndex + size - 1 });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (visibleData.length <= 2) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    const factor = event.deltaY < 0 ? 0.78 : 1.28;
    setWindowSize(Math.round(selectedSize * factor), anchorRatio);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || selectedSize >= visibleData.length) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startIndex: boundedRange.startIndex,
      endIndex: boundedRange.endIndex,
      width: Math.max(1, event.currentTarget.getBoundingClientRect().width)
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const size = drag.endIndex - drag.startIndex + 1;
    const shift = Math.round((-(event.clientX - drag.startX) / drag.width) * size);
    const startIndex = Math.max(0, Math.min(drag.startIndex + shift, visibleData.length - size));
    setViewRange({ startIndex, endIndex: startIndex + size - 1 });
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[hsl(var(--card-muted-foreground))]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded-full bg-[#2563eb]" />
            Повний
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded-full bg-[#16a34a]" />
            Доступний + в обороті
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-muted p-1">
            <button type="button" className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground hover:bg-card" onClick={() => setWindowSize(Math.round(selectedSize * 0.72))} title="Приблизити" aria-label="Приблизити">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground hover:bg-card" onClick={() => setWindowSize(Math.round(selectedSize * 1.4))} title="Віддалити" aria-label="Віддалити">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button type="button" className="grid h-8 w-9 place-items-center rounded-md text-muted-foreground hover:bg-card" onClick={() => setViewRange({ startIndex: 0, endIndex: Math.max(0, visibleData.length - 1) })} title="Скинути масштаб" aria-label="Скинути масштаб">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        className="h-80 w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <ResponsiveContainer>
          <LineChart data={zoomedData} margin={{ left: 0, right: 8, top: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tickCount={6}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--card-muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => hidden ? "****" : new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))}
              width={56}
            />
            <Tooltip
              formatter={(value, name) => {
                const amount = Number(value);
                return [`${formatMoney(amount, "USDT", hidden)} · ${formatMoney(amount * uahRate, "UAH", hidden)}`, name === "full" ? "Повний" : "Доступний + в обороті"];
              }}
              labelFormatter={(_, payload) => `Дата: ${payload?.[0]?.payload?.tooltipLabel || payload?.[0]?.payload?.label || ""}`}
            />
            <Line type="linear" dataKey="full" name="full" stroke="#2563eb" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line type="linear" dataKey="available" name="available" stroke="#16a34a" strokeWidth={2.5} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {visibleData.length > 2 && (
        <div className="mt-1 h-14 w-full">
          <ResponsiveContainer>
            <LineChart data={visibleData} margin={{ left: 56, right: 8, top: 0, bottom: 0 }}>
              <Line type="linear" dataKey="full" stroke="#2563eb" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Brush
                dataKey="label"
                startIndex={boundedRange.startIndex}
                endIndex={boundedRange.endIndex}
                height={30}
                travellerWidth={10}
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
                onChange={(range) => {
                  if (range.startIndex == null || range.endIndex == null) return;
                  setViewRange({ startIndex: range.startIndex, endIndex: range.endIndex });
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
