import { formatCurrency, formatDateLabel, num } from '@/lib/format';
import { TrendTag } from '@/components/ui/TrendTag';
import type { LikeForLikeDay } from '@/lib/types/bookingsDashboard';

// A slope chart: each weekday is one line from its average revenue per
// occurrence in the PREVIOUS period to the same figure in the selected one.
// Direction and steepness are the whole point — "is Friday fading?" is
// answered by the line pointing down, with no axis-reading required.
//
// One row per weekday (rather than the classic single-panel slope chart with
// all seven lines overlaid) because overlaid lines collide and their end
// labels overlap; separate rows keep every value legible while the shared Y
// scale still makes slopes comparable across rows.
//
// Both endpoints are averages PER OCCURRENCE of that weekday, computed
// server-side. That matters twice over: the two windows are equal in days but
// rarely hold the same number of Fridays, and the previous
// first-half/second-half rendering divided by weeks spanned — counting
// boundary weeks that contained no occurrence of a weekday as zero revenue,
// which understated a one-month range by up to 33%.
//
// The sparkline between the endpoints shows every week in the selected range,
// so a weekday that spiked mid-period and crashed no longer reads as flat the
// way a two-point comparison alone would render it.

const VB_H = 44;
const PAD_Y = 7; // keeps dots/stroke clear of the box edges at the extremes
const DOT = 8; // px

const UP = '#2E9E77';
const DOWN = '#E15B5B';

// Shared by the header and every data row, so column edges line up by
// construction rather than by coincidence.
const GRID = 'grid grid-cols-[76px_92px_minmax(60px,1fr)_92px_76px] items-center gap-x-3';

export function WeekdaySlopeChart({ data }: { data: LikeForLikeDay }) {
  const { weekdays, byWeek, comparison } = data;

  // Weekdays that never occurred in range carry no signal — drop them rather
  // than render a row of zeros (matters for short ranges, where a 3-day
  // filter legitimately contains only 3 weekdays).
  const active = weekdays.filter((w) => w.current.occurrences > 0);

  // Occurrences are counted from the calendar, so a range with no bookings at
  // all still reports seven weekdays — they just earned nothing. Check the
  // bookings, not the occurrences, before deciding there's a chart to draw.
  if (active.length === 0 || active.every((w) => w.current.booking_count === 0)) {
    return <p className="py-10 text-center text-sm text-ink-muted">No bookings in this period.</p>;
  }

  // Sparkline series per weekday: that weekday's revenue across every week in
  // the range, in chronological order.
  const weeks = [...new Set(byWeek.map((r) => r.week_start))].sort();
  const seriesByDow = new Map<number, { weekStart: string; value: number }[]>();
  for (const w of active) {
    const byWeekStart = new Map(byWeek.filter((r) => r.iso_weekday === w.iso_weekday).map((r) => [r.week_start, r]));
    // Weeks where this weekday fell outside the range are skipped, not zeroed
    // — a zero would draw a phantom crash into the sparkline.
    seriesByDow.set(
      w.iso_weekday,
      weeks
        .filter((k) => byWeekStart.has(k))
        .map((k) => ({ weekStart: k, value: num(byWeekStart.get(k)!.net_revenue) }))
    );
  }

  // Monday -> Sunday, matching a calendar. Ranking by revenue instead would
  // reshuffle the rows every time the date range changes, which makes two
  // views impossible to compare at a glance.
  const rows = active
    .map((w) => ({
      iso: w.iso_weekday,
      label: w.weekday_label,
      previous: w.previous?.avg_per_occurrence != null ? num(w.previous.avg_per_occurrence) : null,
      current: num(w.current.avg_per_occurrence),
      changePct: w.change_pct,
      occurrences: w.current.occurrences,
      previousOccurrences: w.previous?.occurrences ?? null,
      series: seriesByDow.get(w.iso_weekday) ?? [],
    }))
    .sort((a, b) => a.iso - b.iso);

  const globalMax = Math.max(1, ...rows.flatMap((r) => [r.previous ?? 0, r.current]));
  const yPct = (v: number) => ((VB_H - PAD_Y - (v / globalMax) * (VB_H - PAD_Y * 2)) / VB_H) * 100;

  const hasComparison = comparison != null;

  return (
    <div className="flex flex-col gap-3">
      <div className={`${GRID} px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint`}>
        <span>Weekday</span>
        <span className="whitespace-nowrap text-right">{hasComparison ? 'Prev period' : '—'}</span>
        <span className="truncate text-center font-normal normal-case tracking-normal text-ink-faint/80">
          {weeks.length > 1 ? `week by week · ${weeks.length} weeks` : ''}
        </span>
        <span className="whitespace-nowrap">This period</span>
        <span className="text-center">Change</span>
      </div>

      <div className="flex flex-col">
        {rows.map((wd) => {
          const from = wd.previous ?? wd.current;
          const rising = wd.current >= from;
          const color = rising ? UP : DOWN;
          return (
            <div
              key={wd.iso}
              className={`${GRID} rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-surface-muted/50`}
            >
              <span className="text-[13px] font-semibold text-ink">{wd.label}</span>
              {/* Spells out the denominator behind the average, which is the
                  one thing about this chart that isn't self-evident: "PKR
                  249.6K" means nothing until you know it's 13 Saturdays. */}
              {/* Same weight and colour as "This period": both are measured
                  figures and the reader compares them directly, so greying one
                  out implied it was an estimate or less trustworthy. Which one
                  is which is already carried by the column headers and by the
                  line's direction. */}
              <span
                className="text-right font-heading text-[12.5px] font-semibold tabular-nums text-ink"
                title={
                  wd.previousOccurrences
                    ? `Average of ${wd.previousOccurrences} ${wd.label}s in the previous period`
                    : `No ${wd.label}s in the previous period`
                }
              >
                {wd.previous != null ? formatCurrency(wd.previous) : '—'}
              </span>

              <div className="relative" style={{ height: VB_H }}>
                {/* The line is drawn in a stretched viewBox (preserveAspectRatio
                    "none") so it spans whatever width the column gets; the dots
                    are HTML rather than SVG circles because that same non-uniform
                    stretch would squash circles into ellipses. Both are inset by
                    half a dot so the line's endpoints sit at the dot centers. */}
                {/* height MUST be pinned explicitly: an <svg> with a viewBox
                    and a specified width is a replaced element, so leaving
                    height auto makes the browser derive it from the viewBox's
                    intrinsic ratio (width x 44/100) instead of honouring
                    top/bottom insets — which silently makes the canvas many
                    times taller than the row and spills lines into the rows
                    above and below. */}
                <svg
                  viewBox={`0 0 100 ${VB_H}`}
                  preserveAspectRatio="none"
                  className="absolute top-0"
                  style={{ left: DOT / 2, width: `calc(100% - ${DOT}px)`, height: VB_H }}
                >
                  {wd.previous != null && (
                    <line
                      x1="0"
                      y1={(yPct(wd.previous) / 100) * VB_H}
                      x2="100"
                      y2={(yPct(wd.current) / 100) * VB_H}
                      stroke={color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {/* Week-by-week detail, drawn on the same Y scale as the
                      slope so the two readings agree. Muted and thin: it is
                      texture behind the comparison, not a competing series. */}
                  {wd.series.length > 1 && (
                    <polyline
                      points={wd.series
                        .map((p, i) => {
                          const x = (i / (wd.series.length - 1)) * 100;
                          return `${x},${(yPct(p.value) / 100) * VB_H}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.35}
                      strokeWidth={1}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>

                {/* Invisible hover targets, one per week. Sized generously
                    (full row height, a full slot wide) because the line itself
                    is 1px and impossible to hit with a mouse. */}
                {wd.series.length > 1 &&
                  wd.series.map((p, i) => (
                    <span
                      key={p.weekStart}
                      className="group absolute top-0 h-full"
                      style={{
                        left: `calc(${(i / (wd.series.length - 1)) * 100}% - ${100 / (wd.series.length - 1) / 2}%)`,
                        width: `${100 / (wd.series.length - 1)}%`,
                      }}
                    >
                      <span
                        className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink/15 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                        aria-hidden
                      />
                      {/* Same surface, radius, padding and shadow as the
                          Revenue tab's chart tooltip, so hovering anything on
                          this dashboard produces one consistent object. */}
                      <span
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-xl bg-surface px-3.5 py-2.5 text-xs opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                        style={{ boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)' }}
                        role="tooltip"
                      >
                        <span className="mb-1.5 block font-semibold text-ink">Week of {formatDateLabel(p.weekStart)}</span>
                        <span className="flex items-center justify-between gap-6">
                          <span className="text-ink-muted">{wd.label} revenue</span>
                          <span className="font-heading font-semibold text-ink">{formatCurrency(p.value)}</span>
                        </span>
                      </span>
                    </span>
                  ))}
                {wd.previous != null && (
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: 0,
                      top: `calc(${yPct(wd.previous)}% - ${DOT / 2}px)`,
                      width: DOT,
                      height: DOT,
                      background: color,
                    }}
                  />
                )}
                <span
                  className="absolute rounded-full"
                  style={{
                    right: 0,
                    top: `calc(${yPct(wd.current)}% - ${DOT / 2}px)`,
                    width: DOT,
                    height: DOT,
                    background: color,
                  }}
                />
              </div>

              <span
                className="font-heading text-[12.5px] font-semibold tabular-nums text-ink"
                title={`Average of ${wd.occurrences} ${wd.label}s in this period`}
              >
                {formatCurrency(wd.current)}
              </span>
              <span className="flex justify-center">
                {wd.changePct != null ? (
                  <TrendTag changePct={wd.changePct} className="min-w-[58px] justify-center" />
                ) : (
                  <span className="text-[11px] text-ink-faint">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
