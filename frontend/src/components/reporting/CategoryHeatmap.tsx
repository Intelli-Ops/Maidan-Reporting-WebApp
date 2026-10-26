import { useState } from 'react';
import { formatCurrency, formatDateLabel, formatMonthLabel, num } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CategoryShareOverTimeRow, ExpenseGranularity } from '@/lib/types/expensesDashboard';

// One ROW per category, one COLUMN per period, spend encoded as colour.
// Scales to any number of categories (a 12-series stacked bar cannot — the
// bands end up thinner than their own separator stroke) and needs no legend
// beyond a single low→high ramp.
//
// COLOUR. Five discrete steps, not a continuous alpha fade. A continuous ramp
// gives every cell a slightly different shade, and "slightly different" is
// exactly what the eye cannot resolve — two cells 8% apart in opacity read as
// the same colour. Binning into five fixed blues means any two cells are
// either obviously the same or obviously different, and the steps below are
// spaced roughly evenly in lightness (~13 points apart) so each is
// distinguishable from its neighbours rather than just from the extremes.
// They're opaque rather than alpha-blended so they don't shift with whatever
// the frosted card is sitting on.
const BLUE_STEPS = ['#EAF2FB', '#B7D6F1', '#7BB2E3', '#3B7FC4', '#12508C'] as const;

// Distinctly not-blue, so "no spend at all" never reads as "a little spend".
const ZERO_COLOR = 'rgb(221 227 222 / 0.4)';

const CELL_H = 22;
const CELL_GAP = 3;
const HEADER_H = 18;

/**
 * Bins a value into one of BLUE_STEPS.
 *
 * Uses sqrt rather than a linear share of the peak because spend is heavily
 * skewed — one category (staff, usually) dwarfs the rest, so on a linear
 * scale every other cell collapses into the lightest one or two bins and the
 * grid looks flat. sqrt stretches the bottom of the range, where most cells
 * actually live, while still leaving the true peak alone in the darkest bin.
 */
function stepFor(value: number, peak: number): number {
  if (value <= 0 || peak <= 0) return -1;
  const t = Math.sqrt(value / peak);
  return Math.min(BLUE_STEPS.length - 1, Math.floor(t * BLUE_STEPS.length));
}

/** Rows are ordered by total spend, so the categories that matter sit up top. */
function buildMatrix(rows: CategoryShareOverTimeRow[], granularity: ExpenseGranularity) {
  const periods = [...new Set(rows.map((r) => r.period))].sort((a, b) => a.localeCompare(b));

  const byCategory = new Map<number, { name: string; total: number; cells: Map<string, number> }>();
  for (const row of rows) {
    const entry = byCategory.get(row.top_category_id) ?? {
      name: row.category_name,
      total: 0,
      cells: new Map<string, number>(),
    };
    const amount = num(row.total_amount);
    entry.total += amount;
    entry.cells.set(row.period, (entry.cells.get(row.period) ?? 0) + amount);
    byCategory.set(row.top_category_id, entry);
  }

  const categories = [...byCategory.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  const peak = Math.max(0, ...categories.flatMap((c) => [...c.cells.values()]));
  const label = (period: string) => (granularity === 'monthly' ? formatMonthLabel(period) : formatDateLabel(period));

  return { periods, categories, peak, label };
}

/** Upper bound of each bin, inverting the sqrt so the legend states real money. */
function binCeiling(step: number, peak: number): number {
  return ((step + 1) / BLUE_STEPS.length) ** 2 * peak;
}

export function CategoryHeatmap({
  rows,
  granularity,
}: {
  rows: CategoryShareOverTimeRow[];
  granularity: ExpenseGranularity;
}) {
  const [hovered, setHovered] = useState<{ category: string; period: string; amount: number } | null>(null);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  const { periods, categories, peak, label } = buildMatrix(rows, granularity);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Category labels — deliberately outside the scroller below, so they
            stay readable across a 52-week range without a sticky cell. A
            sticky cell would need an opaque fill, which on a translucent card
            reads as an input field sitting in the chart. */}
        <div className="flex shrink-0 flex-col" style={{ gap: CELL_GAP, paddingTop: HEADER_H + CELL_GAP }}>
          {categories.map((category) => (
            <div
              key={category.id}
              title={category.name}
              className={cn(
                'flex max-w-[160px] items-center justify-end truncate text-right text-[11.5px] transition-colors duration-150',
                hovered?.category === category.name ? 'font-semibold text-ink' : 'font-medium text-ink-muted'
              )}
              style={{ height: CELL_H }}
            >
              {category.name}
            </div>
          ))}
        </div>

        {/* The matrix scrolls sideways on its own rather than widening the
            card: a year of weekly buckets is 52 columns, and the surrounding
            dashboard must never gain a horizontal scrollbar. */}
        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="flex" style={{ gap: CELL_GAP }}>
            {periods.map((period) => (
              <div key={period} className="flex min-w-[38px] flex-1 flex-col" style={{ gap: CELL_GAP }}>
                <div
                  className={cn(
                    'flex items-center justify-center text-[10px] tabular-nums transition-colors duration-150',
                    hovered?.period === period ? 'font-semibold text-ink' : 'font-medium text-ink-faint'
                  )}
                  style={{ height: HEADER_H }}
                  title={label(period)}
                >
                  {label(period)}
                </div>

                {categories.map((category) => {
                  const amount = category.cells.get(period) ?? 0;
                  const step = stepFor(amount, peak);
                  const isHovered = hovered?.category === category.name && hovered?.period === period;

                  return (
                    <div
                      key={category.id}
                      onMouseEnter={() => setHovered({ category: category.name, period, amount })}
                      onMouseLeave={() => setHovered(null)}
                      title={`${category.name} · ${label(period)} — ${formatCurrency(amount)}`}
                      className={cn(
                        'rounded-[5px] outline outline-2 outline-offset-1 outline-transparent transition-[outline-color] duration-150 ease-[var(--ease-maidan)]',
                        isHovered && 'outline-ink'
                      )}
                      style={{
                        height: CELL_H,
                        backgroundColor: step < 0 ? ZERO_COLOR : BLUE_STEPS[step],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] text-ink-faint">
          {hovered ? (
            <span className="text-ink-muted">
              <span className="font-medium text-ink">{hovered.category}</span> · {label(hovered.period)} —{' '}
              <span className="font-heading font-semibold tabular-nums text-ink">
                {formatCurrency(hovered.amount)}
              </span>
            </span>
          ) : (
            `${categories.length} categories × ${periods.length} periods · hover a cell for the exact figure`
          )}
        </p>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-faint">Less</span>
          {BLUE_STEPS.map((color, step) => (
            <span
              key={color}
              className="h-3.5 w-6 rounded-[3px] ring-1 ring-inset ring-ink/[0.06]"
              style={{ backgroundColor: color }}
              // Each swatch names the band it stands for, so the ramp is
              // readable as money rather than only as "darker is more".
              title={`up to ${formatCurrency(binCeiling(step, peak))}`}
            />
          ))}
          <span className="text-[10px] text-ink-faint">More</span>
          <span className="ml-1 text-[10px] tabular-nums text-ink-faint">peak {formatCurrency(peak)}</span>
        </div>
      </div>
    </div>
  );
}
