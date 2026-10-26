import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, CHART_MARGIN } from '@/components/reporting/chartAxis';
import { TrendTag } from '@/components/ui/TrendTag';
import { formatCompactNumber, formatDateWithYear } from '@/lib/format';
import { bucketsForRows, countsByBucket, type SlotWidth } from '@/lib/timeSlots';
import type { ByTimeSlot } from '@/lib/types/bookingsDashboard';

const CURRENT_COLOR = '#185FA5';
const PREVIOUS_COLOR = '#C3D3E2';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

// The change is computed here rather than server-side because the slot width
// is a client-side choice — the percentages have to be recomputed whenever
// the user regroups 2-hour blocks into 3-hour ones.
function changePct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function ComparisonTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const current = Number(payload.find((e) => e.dataKey === 'current')?.value) || 0;
  const previous = Number(payload.find((e) => e.dataKey === 'previous')?.value) || 0;
  const change = changePct(current, previous);

  return (
    <div className="rounded-xl bg-surface px-3.5 py-2.5 text-xs" style={{ boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)' }}>
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} />
            This period
          </span>
          <span className="font-heading font-semibold text-ink">{formatCompactNumber(current)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PREVIOUS_COLOR }} />
            Previous period
          </span>
          <span className="font-heading font-semibold text-ink">{formatCompactNumber(previous)}</span>
        </div>
      </div>
      {change != null && (
        <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-black/[0.06] pt-1.5">
          <span className="text-ink-muted">Change</span>
          <TrendTag changePct={change} />
        </div>
      )}
    </div>
  );
}

/**
 * The same time slots, this period against the one immediately before it —
 * "how many bookings were there last month in the 6-9 slot".
 *
 * Paired bars rather than a single change-percentage bar: a slot that went
 * from 2 bookings to 4 is +100% and a slot that went from 180 to 200 is +11%,
 * and only the second one matters. Showing both absolute heights makes the
 * size of each slot visible alongside its movement.
 */
export function SlotComparisonChart({ data, width }: { data: ByTimeSlot; width: SlotWidth }) {
  const { comparison, current, previous } = data;

  if (!comparison || !previous) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        Pick a start and end date to compare against the period before it.
      </p>
    );
  }
  if (current.length === 0 && previous.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No bookings in either period.</p>;
  }

  // Buckets come from BOTH windows: a slot that had bookings last period and
  // none this one is exactly the kind of drop-off worth showing, and deriving
  // the axis from the current window alone would hide it.
  const buckets = bucketsForRows([...current, ...previous], width);
  const currentCounts = countsByBucket(current, width);
  const previousCounts = countsByBucket(previous, width);

  const rows = buckets.map((bucket) => ({
    label: bucket.label,
    current: currentCounts.get(bucket.key) ?? 0,
    previous: previousCounts.get(bucket.key) ?? 0,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} margin={CHART_MARGIN} barGap={2}>
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#DDE3DE' }} tick={AXIS_TICK} interval={0} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v) => formatCompactNumber(Number(v))}
            width={44}
            allowDecimals={false}
          />
          <Tooltip content={<ComparisonTooltip />} cursor={{ fill: '#F0F2EF' }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#66716B', paddingTop: 8 }} />
          {/* Previous is drawn first so it sits to the LEFT of the current
              bar — the earlier period reads earlier along the axis. */}
          <Bar dataKey="previous" name="Previous period" fill={PREVIOUS_COLOR} radius={[3, 3, 0, 0]} />
          <Bar dataKey="current" name="This period" fill={CURRENT_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-3 text-[11px] leading-snug text-ink-faint">
        Previous period: {formatDateWithYear(comparison.startDate)} – {formatDateWithYear(comparison.endDate)}
      </p>
    </div>
  );
}
