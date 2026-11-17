import type { RateInfo } from "@/lib/dashboard";
import { formatPlain } from "@/lib/money";
import { rateSourceLine } from "@/lib/rate-display";

/** «Курс 46,31 / мій 45,47 UAH/USDT» with the source and update time under it. */
export function RateBadge({ info, className = "" }: { info: RateInfo; className?: string }) {
  return (
    <div className={`text-xs text-[hsl(var(--card-muted-foreground))] ${className}`}>
      <div>
        Курс <b className="font-semibold text-foreground tabular-nums">{formatPlain(info.rate)}</b>
        {info.myAverage && (
          <>
            {" / "}мій <b className="font-semibold tabular-nums">{formatPlain(info.myAverage.rate)}</b>
          </>
        )}{" "}
        UAH/USDT
      </div>
      <div className="mt-0.5 text-[11px]">{rateSourceLine(info)}</div>
      {info.myAverage && <div className="text-[11px]">«Мій» — середній курс останніх {info.myAverage.count} P2P-виводів</div>}
    </div>
  );
}
