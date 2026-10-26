import { useState } from 'react';
import { ChartCard } from '@/components/reporting/ChartCard';
import { GranularityToggle } from '@/components/reporting/GranularityToggle';
import { SlotComparisonChart } from '@/components/reporting/SlotComparisonChart';
import { TimeSlotStatusChart } from '@/components/reporting/TimeSlotStatusChart';
import type { SlotWidth } from '@/lib/timeSlots';
import type { BookingsDashboardData } from '@/lib/types/bookingsDashboard';

const WIDTH_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'Hourly' },
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
];

// A handful of rows out of thousands rounds to "0%", which reads as though
// the sentence is contradicting itself — it names a non-zero count and then
// calls it zero. Below half a percent, say so as an upper bound instead.
function formatSharePct(part: number, total: number): string {
  const pct = (part / total) * 100;
  if (pct < 0.5) return '<1%';
  return `${Math.round(pct)}%`;
}

export function TimeSlotsTab({ data }: { data: BookingsDashboardData }) {
  const { byTimeSlot } = data;

  // Block width is local state, not a URL param like `granularity`. Every
  // other dashboard control is in the URL because it changes what the API is
  // asked for; this one only regroups rows already in hand, so putting it in
  // the query string would churn the React Query key and refetch the whole
  // 12-section payload to redraw the same numbers.
  const [width, setWidth] = useState<SlotWidth>(2);

  // Unparsed slots are already visible as their own "Unknown" bar, but the
  // share is large enough (~15% of all bookings) that it deserves saying in
  // words — otherwise the bar reads as a rounding error rather than as a data
  // quality issue worth fixing upstream.
  const unknownCount = byTimeSlot.current
    .filter((r) => r.slot_start_hour == null)
    .reduce((sum, r) => sum + r.booking_count, 0);
  const totalCount = byTimeSlot.current.reduce((sum, r) => sum + r.booking_count, 0);
  const unknownNote =
    unknownCount > 0 && totalCount > 0
      ? `${unknownCount.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} bookings (${formatSharePct(unknownCount, totalCount)}) have no readable time slot in the source sheet, and are grouped under "Unknown".`
      : undefined;

  const widthToggle = (
    <GranularityToggle
      value={String(width)}
      onChange={(v) => setWidth(Number(v) as SlotWidth)}
      options={WIDTH_OPTIONS}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <ChartCard
        title="Bookings by Time Slot"
        description="Every booking in the selected period, placed in the slot it starts in and split by status."
        actions={widthToggle}
        caption={unknownNote}
      >
        <TimeSlotStatusChart rows={byTimeSlot.current} statuses={byTimeSlot.statuses} width={width} />
      </ChartCard>

      <ChartCard
        title="Time Slot vs Previous Period"
        description="The same slots over the period immediately before this one, of equal length."
        actions={widthToggle}
      >
        <SlotComparisonChart data={byTimeSlot} width={width} />
      </ChartCard>
    </div>
  );
}
