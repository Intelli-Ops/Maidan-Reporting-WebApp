import type { ReactNode } from 'react';
import { CHANGE_SLOT_TOTAL_PX } from '@/components/reporting/ValueWithChange';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
  /** Renders the cell content as a rounded brand chip — use on the row's identifying column (facility, payment method, etc). */
  pill?: boolean;
  /** CSS width (e.g. '110px') — pins narrow numeric columns so browser auto-table-layout doesn't stretch leftover space unevenly between them, which is what makes a row of short right-aligned numbers look loosely/inconsistently spaced. */
  width?: string;
  /**
   * Set on right-aligned columns rendered with <ValueWithChange>. Shifts the
   * heading left by the width of the change-badge slot so it sits above the
   * VALUE rather than above the badge that trails it.
   */
  changeSlot?: boolean;
  /**
   * Small qualifier chip beside the heading (e.g. "All time") for a column
   * whose basis differs from the rest of the table — the case that actually
   * misleads is a filter-independent column sitting next to windowed ones.
   */
  headerNote?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing to show.',
  fixedLayout = false,
  gridlines = false,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  /**
   * Honour `width` exactly instead of letting the browser redistribute slack.
   * With auto layout, a wide text column absorbs all leftover space and shoves
   * the narrow numeric columns to the far right, leaving a gulf mid-row. Set
   * this and give every column a percentage width to keep them evenly placed.
   */
  fixedLayout?: boolean;
  /**
   * Rule off every cell, not just every row.
   *
   * A wide identity column next to a short name leaves a lot of empty space
   * before the first number, and with only horizontal rules that space reads
   * as a gap between two columns rather than as one column's own cell — so
   * the headings look detached from the figures under them even when they are
   * aligned to the pixel. Vertical rules give each column a visible boundary
   * and the whitespace becomes obviously interior to a cell.
   */
  gridlines?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <div className={cn('overflow-x-auto', gridlines && 'rounded-xl border border-border')}>
      <table className={cn('w-full border-collapse text-sm', fixedLayout && 'table-fixed')}>
        <thead>
          {/*
            The header sits on its own tinted band with matching horizontal
            padding to the cells below. Header and first data row previously
            shared only whitespace, which let a right-aligned heading drift
            visually away from the column of numbers under it.
          */}
          <tr className="bg-surface-muted/70">
            {columns.map((c, i) => (
              <th
                key={c.key}
                style={{
                  ...(c.width ? { width: c.width } : null),
                  // 16px is the cell's own px-4; the slot is added on top of
                  // it. Right-aligned only — a centred cell balances value and
                  // badge about the centre line and reserves no slot.
                  ...(c.changeSlot && c.align === 'right'
                    ? { paddingRight: `${16 + CHANGE_SLOT_TOTAL_PX}px` }
                    : null),
                }}
                className={cn(
                  'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-label',
                  gridlines
                    ? cn('border-b border-border', i < columns.length - 1 && 'border-r')
                    : 'first:rounded-l-lg last:rounded-r-lg',
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                )}
              >
                {c.headerNote ? (
                  // Stacked, not inline: these columns are the narrow numeric
                  // ones, and a chip sitting beside the label overflows the
                  // column and breaks mid-word ("All" / "time"). On its own
                  // line the chip stays whole at any column width, and the
                  // label keeps the column's aligned edge so it still sits
                  // directly over the values.
                  <span
                    className={cn(
                      'flex flex-col gap-1',
                      c.align === 'right' ? 'items-end' : c.align === 'center' ? 'items-center' : 'items-start'
                    )}
                  >
                    <span>{c.label}</span>
                    <span
                      className="whitespace-nowrap rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-ink-muted"
                      title={`${c.label} is a lifetime figure and ignores the date filter`}
                    >
                      {c.headerNote}
                    </span>
                  </span>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowKey(row)}
              className="transition-colors duration-150 even:bg-surface-muted/25 hover:bg-blue-soft/40"
            >
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-3.5 align-middle tabular-nums text-ink',
                    gridlines
                      ? cn(
                          i < columns.length - 1 && 'border-r border-border',
                          rowIdx < rows.length - 1 && 'border-b border-border'
                        )
                      : 'border-t border-black/[0.04]',
                    c.align === 'right'
                      ? 'text-right font-heading'
                      : c.align === 'center'
                        ? 'text-center font-heading'
                        : 'text-left'
                  )}
                >
                  {c.pill ? (
                    // Deliberately a text treatment, not a chip. A chip has
                    // horizontal padding of its own, which offsets its label
                    // from the column heading by exactly that padding — the
                    // chip's box and its text cannot both sit on the cell's
                    // padding edge. Colour carries the emphasis instead, so
                    // the identifying column lines up under its heading to the
                    // pixel, in every table on every dashboard.
                    <span className="text-[13px] font-semibold text-blue">{c.render(row)}</span>
                  ) : (
                    c.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
