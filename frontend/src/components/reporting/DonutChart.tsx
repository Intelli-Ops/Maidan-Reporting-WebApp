import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { colorForIndex } from '@/components/reporting/colors';
import { TrendTag } from '@/components/ui/TrendTag';
import { cn } from '@/lib/utils';

export interface DonutDatum {
  label: string;
  value: number;
  /** Pre-formatted share of total, e.g. "42.5%" — shown next to the value in the legend when present. */
  share?: string;
  /** vs the immediately preceding period of equal length; omitted/null when there's nothing to compare against. */
  changePct?: number | null;
}

// No Recharts <Tooltip> here on purpose: for a donut this small (190px),
// its default cursor-tracking position lands right on top of the
// center label, so hovering a slice overlaid two blocks of text on top of
// each other. Swapping the center label's own content on hover instead
// gives the same "what's this slice" info with nowhere for it to collide.
export function DonutChart({ data, centerLabel = 'Total' }: { data: DonutDatum[]; centerLabel?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const active = activeIndex != null ? data[activeIndex] : null;
  // Bars are scaled to the biggest category, not to the total: scaled to the
  // total the leader would fill barely half the track and everything below it
  // would be a stub, which is exactly the length range the eye is worst at.
  const max = Math.max(...data.map((d) => d.value), 0);
  const hasTrend = data.some((d) => d.changePct != null);

  // The ranked bar only earns its column once the legend is genuinely wide (a
  // full-width card); in a two-up grid there is no room for it, so it drops out
  // and the row falls back to label -> amount -> share.
  const columns = hasTrend
    ? 'grid-cols-[minmax(0,1fr)_auto_auto_auto] @[600px]:grid-cols-[minmax(0,auto)_minmax(72px,1fr)_auto_auto_auto]'
    : 'grid-cols-[minmax(0,1fr)_auto_auto] @[600px]:grid-cols-[minmax(0,auto)_minmax(72px,1fr)_auto_auto]';

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-6 @[600px]:flex-row @[600px]:gap-8">
        <div className="relative h-[190px] w-[190px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={90}
                paddingAngle={3}
                cornerRadius={6}
                stroke="none"
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={colorForIndex(i)}
                    opacity={activeIndex == null || activeIndex === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <p className="font-heading text-[19px] font-semibold tabular-nums text-ink">
              {formatCurrency(active ? active.value : total)}
            </p>
            <p className="truncate text-[11px] text-ink-muted" title={active ? active.label : centerLabel}>
              {active ? active.label : centerLabel}
            </p>
          </div>
        </div>

        {/* No gap-x: the columns are padded from the inside instead, so each
            row's hairline rule runs unbroken from the label to the last
            number. That rule is what carries the eye across a legend this
            wide — without it a name on the left and a figure on the right
            read as two separate lists. */}
        <div className={cn('grid w-full flex-1 items-center text-sm', columns)}>
          {data.map((d, i) => {
            const dimmed = activeIndex != null && activeIndex !== i;
            // Not `last:border-b-0`: under display:contents `:last-child`
            // matches the last CELL of every row, which would strip the rule
            // from the rightmost column on all of them instead of from the
            // final row.
            const cell = cn(
              'py-2.5 transition-opacity',
              i < data.length - 1 && 'border-b border-black/[0.05]',
              dimmed && 'opacity-45'
            );

            return (
              // display:contents lets each row's cells drop straight into the
              // parent grid (so amount/share/trend line up in real columns
              // instead of per-row flex boxes sized to that row's own content)
              // while keeping one hoverable group per legend entry.
              <div
                key={d.label}
                className="contents"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span className={cn(cell, 'flex min-w-0 items-center gap-2 pr-4 text-ink')}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForIndex(i) }} />
                  <span className="truncate" title={d.label}>
                    {d.label}
                  </span>
                </span>
                <span className={cn(cell, 'hidden pr-5 @[600px]:block')}>
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.05]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: max > 0 ? `${Math.max((d.value / max) * 100, 1.5)}%` : '0%',
                        backgroundColor: colorForIndex(i),
                      }}
                    />
                  </span>
                </span>
                <span className={cn(cell, 'text-right font-heading font-semibold tabular-nums text-ink')}>
                  {formatCurrency(d.value)}
                </span>
                <span className={cn(cell, 'w-[52px] pl-3 text-right text-[11px] font-medium tabular-nums text-ink-faint')}>
                  {d.share ?? ''}
                </span>
                {hasTrend && (
                  <span className={cn(cell, 'flex justify-end pl-3')}>
                    {d.changePct != null && <TrendTag changePct={d.changePct} className="min-w-[52px] justify-center" />}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
