import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { colorForStatus } from '@/components/reporting/colors';
import { AXIS_TICK, CHART_MARGIN } from '@/components/reporting/chartAxis';
import { formatCompactNumber } from '@/lib/format';
import { bucketsForRows, countsByBucketAndStatus, type SlotWidth } from '@/lib/timeSlots';
import type { TimeSlotRow } from '@/lib/types/bookingsDashboard';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

// Segments are listed busiest-first for the hovered slot, while the STACK
// order stays fixed across every bar — same split as FacilityShareChart's
// tooltip. Holding the stacking constant is what lets the eye follow one
// status across the axis; ranking the tooltip is what answers "what is this
// bar actually made of". Zero segments are dropped: at seven statuses, most
// slots carry three or four, and listing the empty ones buries them.
function SlotTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const present = payload.filter((e) => (Number(e.value) || 0) > 0);
  if (present.length === 0) return null;
  const sorted = [...present].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const total = sorted.reduce((sum, e) => sum + (Number(e.value) || 0), 0);

  return (
    <div className="rounded-xl bg-surface px-3.5 py-2.5 text-xs" style={{ boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)' }}>
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <div className="flex flex-col gap-1">
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.dataKey}
            </span>
            <span className="font-heading font-semibold text-ink">{formatCompactNumber(Number(entry.value) || 0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-black/[0.06] pt-1.5">
        <span className="text-ink-muted">Total</span>
        <span className="font-heading font-semibold text-ink">{formatCompactNumber(total)}</span>
      </div>
    </div>
  );
}

/**
 * Bookings per time slot, stacked by status.
 *
 * Counts, not revenue: a cancelled or complimentary booking occupies the slot
 * either way, and this chart is about which slots fill up. Revenue by slot is
 * a different question and would make the cancelled segment vanish, which is
 * precisely the part worth seeing.
 */
export function TimeSlotStatusChart({
  rows,
  statuses,
  width,
}: {
  rows: TimeSlotRow[];
  statuses: string[];
  width: SlotWidth;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No bookings in this period.</p>;
  }

  const buckets = bucketsForRows(rows, width);
  const counts = countsByBucketAndStatus(rows, width);

  type SlotDatum = { label: string } & Record<string, string | number>;
  const data: SlotDatum[] = buckets.map((bucket) => {
    const byStatus = counts.get(bucket.key);
    const datum: SlotDatum = { label: bucket.label };
    for (const status of statuses) datum[status] = byStatus?.get(status) ?? 0;
    return datum;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#DDE3DE' }} tick={AXIS_TICK} interval={0} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(v) => formatCompactNumber(Number(v))}
          width={44}
          allowDecimals={false}
        />
        <Tooltip content={<SlotTooltip />} cursor={{ fill: '#F0F2EF' }} />
        {/* Recharts' Legend defaults to `itemSorter: 'value'`, which sorts
            the entries alphabetically — so the legend came out starting at
            "Academy" while the stack starts at "Done", and the two could not
            be read against each other. Supplying a payload does not help;
            the sort is applied after it. Sorting by position in `statuses`
            instead puts legend and stack in the same busiest-first order. */}
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#66716B', paddingTop: 8 }}
          itemSorter={(item) => statuses.indexOf(String(item.value))}
        />
        {statuses.map((status, i) => (
          <Bar
            key={status}
            dataKey={status}
            stackId="status"
            fill={colorForStatus(status, i)}
            // Square segments with a hairline separator, NOT the rounded +
            // 3px-white-stroke treatment FacilityShareChart uses. That chart
            // stacks three facilities into three fat blocks; this one stacks
            // seven statuses where the long tail is only a few pixels tall,
            // and at that size a rounded segment inside a thick white gap
            // stops reading as part of the bar — the stack came out looking
            // like loose stripes hovering above a blue column.
            radius={0}
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
