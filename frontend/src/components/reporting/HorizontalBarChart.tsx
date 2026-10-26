import { formatCurrency } from '@/lib/format';
import { TrendTag } from '@/components/ui/TrendTag';

export interface HorizontalBarDatum {
  label: string;
  value: number;
  /** Pre-formatted share of total, e.g. "42.5%" — shown as a small chip next to the value when present. */
  share?: string;
  /** vs the immediately preceding period of equal length; omitted/null when there's nothing to compare against. */
  changePct?: number | null;
}

// Rounded track + gradient fill + floating value badge, rather than a thin
// Recharts bar — these rows rank one metric (revenue) across facilities/
// sports of the same kind, so a single brand-blue gradient is used
// throughout rather than a distinct hue per row (that would imply a
// category difference that isn't there).
export function HorizontalBarChart({ data }: { data: HorizontalBarDatum[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="grid grid-cols-[minmax(88px,128px)_minmax(60px,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-4">
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, 4);
        return (
          // display:contents keeps every row's cells in the shared grid above
          // (not a per-row flex box), so the bar/amount/share/trend columns
          // line up across rows regardless of how long a facility name is.
          <div key={d.label} className="contents">
            <span className="text-[12.5px] leading-tight font-medium text-ink">{d.label}</span>
            <div className="relative h-3 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #378ADD, #185FA5)' }}
              />
            </div>
            <span className="text-right font-heading text-[13px] font-semibold tabular-nums text-ink">
              {formatCurrency(d.value)}
            </span>
            <span className="text-right">
              {d.share && (
                <span className="rounded-full bg-blue-soft px-1.5 py-0.5 text-[10px] font-semibold text-blue">
                  {d.share}
                </span>
              )}
            </span>
            <span className="flex justify-end">
              {d.changePct != null && <TrendTag changePct={d.changePct} className="min-w-[52px] justify-center" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
