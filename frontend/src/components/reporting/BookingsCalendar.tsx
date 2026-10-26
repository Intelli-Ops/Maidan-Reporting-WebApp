import { useState } from 'react';
import { apiDate, formatCurrency, formatDateLabel, formatDateWithYear, formatMonthYear } from '@/lib/format';
import type { RevenueHeatmapCell } from '@/lib/types/bookingsDashboard';

const WEEKDAY_INITIALS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// 5 discrete intensity steps rather than a continuous gradient — the design
// system calls for a restrained treatment that exposes patterns rather than a
// colorful graphic. Text flips to white on the two darkest steps for contrast.
const LEVEL_STYLES = [
  'bg-surface-muted text-ink-faint',
  'bg-blue/15 text-ink',
  'bg-blue/35 text-ink',
  'bg-blue/60 text-white',
  'bg-blue text-white',
];

function densityLevel(count: number, max: number): number {
  if (count === 0) return 0;
  const ratio = count / Math.max(max, 1);
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// 1 = Mon .. 7 = Sun, matching the API's ISODOW convention.
function isoWeekdayOf(y: number, m: number, d: number): number {
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function BookingsCalendar({
  cells,
  startDate,
  endDate,
}: {
  cells: RevenueHeatmapCell[];
  startDate?: string | null;
  endDate?: string | null;
}) {
  const [hovered, setHovered] = useState<RevenueHeatmapCell | null>(null);

  if (cells.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No bookings in this period.</p>;
  }

  const byDate = new Map(cells.map((c) => [apiDate(c.booking_date), c]));
  const dates = [...byDate.keys()].sort();

  // Prefer the *filter* bounds over the observed data bounds: a day inside the
  // selected range with no bookings is a real, meaningful zero, while a day
  // outside it isn't part of this view at all and must render blank rather
  // than as a misleading "quiet day".
  const rangeStart = startDate ? apiDate(startDate) : dates[0];
  const rangeEnd = endDate ? apiDate(endDate) : dates[dates.length - 1];

  const maxCount = Math.max(1, ...cells.map((c) => c.booking_count));

  const [sy, sm] = rangeStart.split('-').map(Number);
  const [ey, em] = rangeEnd.split('-').map(Number);
  const months: { y: number; m: number }[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    months.push({ y, m });
  }

  const totalBookings = cells.reduce((s, c) => s + c.booking_count, 0);

  // Quietest is picked from days that actually traded. A day with no bookings
  // at all is usually a closure or a gap in the data rather than a genuinely
  // slow day, and surfacing it as "your quietest day" would be misleading.
  const trading = cells.filter((c) => c.booking_count > 0);
  const busiest = trading.reduce<RevenueHeatmapCell | null>(
    (best, c) => (c.booking_count > (best?.booking_count ?? -1) ? c : best),
    null
  );
  const quietest = trading.reduce<RevenueHeatmapCell | null>(
    (least, c) => (c.booking_count < (least?.booking_count ?? Infinity) ? c : least),
    null
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Stats sit above the grid on their own full-width row, so the layout
          reads identically whether one month is shown or three. Previously
          they were a flex sibling of the months and slid around to fill
          whatever space the calendars left over. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Total Bookings" value={totalBookings.toLocaleString()} sub={`across ${cells.length} days`} />
        <StatTile
          label="Busiest Day"
          value={busiest ? formatDateLabel(busiest.booking_date) : '—'}
          sub={busiest ? `${busiest.booking_count} booking${busiest.booking_count === 1 ? '' : 's'}` : undefined}
          tone="busy"
        />
        <StatTile
          label="Quietest Day"
          value={quietest ? formatDateLabel(quietest.booking_date) : '—'}
          sub={quietest ? `${quietest.booking_count} booking${quietest.booking_count === 1 ? '' : 's'}` : undefined}
          tone="quiet"
        />
      </div>

      {/* Swaps content on hover rather than a floating tooltip: a per-cell
          tooltip near the grid edges would clip against the card. Same
          pattern as DonutChart's center label. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-surface-muted px-3.5 py-2.5 text-xs">
        {hovered ? (
          <>
            <span className="font-semibold text-ink">{formatDateWithYear(hovered.booking_date)}</span>
            <span className="flex items-center gap-4">
              <span className="text-ink-muted">
                {hovered.booking_count} booking{hovered.booking_count === 1 ? '' : 's'}
              </span>
              <span className="font-heading font-semibold text-ink">{formatCurrency(hovered.net_revenue)}</span>
            </span>
          </>
        ) : (
          <span className="text-ink-muted">Hover any date to see that day's bookings and revenue.</span>
        )}
      </div>

      {/* auto-fit rather than flex-wrap: one month centres itself in a single
          column instead of hugging the left edge with a void beside it, and
          three months distribute evenly. */}
      <div className="grid items-start justify-center gap-x-8 gap-y-7 [grid-template-columns:repeat(auto-fit,minmax(240px,260px))]">
        {months.map(({ y, m }) => {
          const total = daysInMonth(y, m);
          const leading = isoWeekdayOf(y, m, 1) - 1;
          const slots: (number | null)[] = [
            ...Array<null>(leading).fill(null),
            ...Array.from({ length: total }, (_, i) => i + 1),
          ];

          return (
            <div key={`${y}-${m}`} className="w-full">
              <p className="mb-2.5 text-center font-heading text-[13px] font-semibold text-ink">
                {formatMonthYear(`${y}-${pad(m)}-01`)}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_INITIALS.map((w) => (
                  <div key={w} className="pb-1 text-center text-[10px] font-medium text-ink-faint">
                    {w}
                  </div>
                ))}
                {slots.map((day, i) => {
                  if (day == null) return <div key={`pad-${i}`} className="aspect-square" />;
                  const iso = `${y}-${pad(m)}-${pad(day)}`;
                  if (iso < rangeStart || iso > rangeEnd) {
                    return <div key={iso} className="aspect-square" />;
                  }
                  const cell = byDate.get(iso);
                  const count = cell?.booking_count ?? 0;
                  return (
                    <div
                      key={iso}
                      onMouseEnter={() => cell && setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex aspect-square items-center justify-center rounded-[9px] text-[11.5px] font-medium tabular-nums transition-transform duration-100 ${LEVEL_STYLES[densityLevel(count, maxCount)]} ${
                        cell ? 'cursor-default hover:scale-[1.12]' : ''
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-ink-faint">
        <span>Quieter</span>
        <div className="flex gap-1">
          {LEVEL_STYLES.map((cls, i) => (
            <div key={i} className={`h-3 w-3 rounded-[4px] ${cls.split(' ')[0]}`} />
          ))}
        </div>
        <span>Busier</span>
      </div>
    </div>
  );
}

// Boxed rather than the bare Metric used elsewhere: these three sit above a
// dense grid of coloured cells, and without a surface of their own they read
// as floating labels belonging to the calendar rather than as its summary.
function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'busy' | 'quiet';
}) {
  const dot =
    tone === 'busy' ? 'bg-blue' : tone === 'quiet' ? 'bg-blue/25' : null;

  return (
    <div className="rounded-xl border border-black/[0.04] bg-surface-muted/60 px-4 py-3">
      <div className="flex items-center gap-1.5">
        {dot && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-[3px] ${dot}`} />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      </div>
      <p className="mt-1.5 font-heading text-[19px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-ink-muted">{sub}</p>}
    </div>
  );
}
