"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { formatPlain, formatSigned } from "@/lib/money";
import type { SourcePoint } from "@/lib/poly-source-series";
import type { PolySectionKey } from "@/lib/poly-stats";
import { cn } from "@/lib/ui";
import { muted, tone, trades as tradeCount } from "./poly-below-min/kit";
import { pct } from "./poly-below-variants/shared";
import type { BelowSource } from "./poly-below-variants/data";

// One fixed colour per source (blue, amber, violet): none of them reads as profit green or loss red,
// and the three stay apart for colour-blind eyes on both the black and the white surface.
export const SOURCE_COLORS: Record<PolySectionKey, string> = {
  MANUAL: "#3987e5",
  COPYTRADE: "#c98500",
  AI_AGENT: "#9b5de5",
};

const TICK = { fontSize: 9, fill: "hsl(var(--card-muted-foreground) / 0.7)" };
const dm = (t: number) => new Date(t).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit" });
const stamp = (t: number) =>
  new Date(t).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** First and last date hug the plot edges so a narrow card never clips them. */
function DateTick({ x, y, payload, index, count }: { x?: number; y?: number; payload?: { value: number }; index?: number; count: number }) {
  const anchor = index === 0 ? "start" : index === count - 1 ? "end" : "middle";
  return (
    <text x={x} y={y} dy="0.71em" textAnchor={anchor} {...TICK}>
      {payload ? dm(payload.value) : ""}
    </text>
  );
}

function SourceTooltip({ active, payload, sources, hidden }: { active?: boolean; payload?: Array<{ payload: SourcePoint }>; sources: BelowSource[]; hidden: boolean }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow">
      <div className={muted}>{stamp(point.t)}</div>
      {sources.map((source) => (
        <div key={source.key} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source.key] }} />
            {source.label}
          </span>
          <span className={cn("tabular-nums", !hidden && tone(point[source.key]))}>{hidden ? "••••" : formatSigned(point[source.key])}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * "Що приносить прибуток": a square per source (result, trades, win rate) and, under them,
 * the running PnL of every source over time. The coloured dots in the squares are the chart legend.
 */
export function PolySources({ sources, series, hidden }: { sources: BelowSource[]; series: SourcePoint[]; hidden: boolean }) {
  // A source with no settled trade has no line: a flat zero would look like a result.
  const drawn = sources.filter((source) => series.some((point) => point[source.key] !== 0));
  const values = series.flatMap((point) => drawn.map((source) => point[source.key]));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const pad = (high - low) * 0.08 || 1;
  // Zero always gets its label; an extreme too close to zero would print on top of it, so it is left to the grid.
  const near = (high - low) * 0.15;
  const levels = [...new Set([low, 0, high].filter((value) => value === 0 || Math.abs(value) > near).map((value) => Math.round(value * 100) / 100))];
  const first = series[0]?.t ?? 0;
  const last = series.at(-1)?.t ?? 0;
  const dates = [...new Set([first, Math.round((first + last) / 2), last])];
  const enough = series.length >= 3 && drawn.length > 0 && last > first;

  return (
    <Card data-poly-sources className="mt-4 px-5 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
      <h2 className="text-[15px] font-bold sm:text-xl">Що приносить прибуток</h2>
      <div className={cn("mt-0.5 text-xs", muted)}>За весь час, USD</div>

      <div className="mt-3 grid grid-cols-3 rounded-lg bg-muted">
        {sources.map((source, index) => {
          const row = source.all;
          return (
            <div key={source.key} className={cn("min-w-0 px-2 py-3 sm:px-4", index % 3 && "border-l border-foreground/15", index >= 3 && "border-t border-foreground/15")}>
              <div className={cn("flex items-center gap-1.5 text-xs sm:text-sm", muted)}>
                <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source.key] }} />
                <span className="truncate">{source.label}</span>
              </div>
              <div className={cn("mt-1 truncate text-base font-bold tabular-nums sm:text-xl", row.count && !hidden ? tone(row.pnl) : "", !row.count && muted)}>
                {hidden ? "••••" : row.count ? formatSigned(row.pnl) : formatPlain(0)}
              </div>
              <div className={cn("mt-0.5 text-[11px] leading-snug sm:text-xs", muted)}>
                {row.count ? (
                  <>
                    <span className="block">{tradeCount(row.count)}</span>
                    <span className="block whitespace-nowrap">вінрейт {pct(row.winRate, hidden)}</span>
                  </>
                ) : (
                  "угод немає"
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg bg-muted p-2">
        {enough ? (
          <div className="relative h-44 sm:h-56">
            <span className={cn("pointer-events-none absolute right-0 top-0 z-10 rounded bg-muted/80 px-1 text-[11px] font-medium", muted)}>Накопичений PnL</span>
            <div className="absolute inset-0">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} horizontalValues={levels} stroke="hsl(var(--foreground) / 0.08)" strokeDasharray="2 3" />
                  <ReferenceLine y={0} stroke="hsl(var(--foreground) / 0.25)" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={[first, last]}
                    ticks={dates}
                    interval={0}
                    height={13}
                    tickSize={0}
                    tickMargin={3}
                    axisLine={false}
                    tickLine={false}
                    tick={<DateTick count={dates.length} />}
                  />
                  <YAxis
                    domain={[low - pad, high + pad]}
                    ticks={levels}
                    interval={0}
                    mirror
                    axisLine={false}
                    tickLine={false}
                    tick={{ ...TICK, dy: -5, stroke: "hsl(var(--muted))", strokeWidth: 3, paintOrder: "stroke" }}
                    tickFormatter={(value: number) => (hidden ? "" : formatPlain(value))}
                  />
                  <Tooltip content={<SourceTooltip sources={drawn} hidden={hidden} />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
                  {drawn.map((source) => (
                    <Line
                      key={source.key}
                      type="monotone"
                      dataKey={source.key}
                      name={source.label}
                      stroke={SOURCE_COLORS[source.key]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{ r: 4, fill: SOURCE_COLORS[source.key], stroke: "hsl(var(--muted))", strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className={cn("flex h-28 items-center justify-center text-sm", muted)}>Недостатньо даних</div>
        )}
      </div>
    </Card>
  );
}
