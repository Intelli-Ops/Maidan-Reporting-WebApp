import type { TimeSlotRow } from '@/lib/types/bookingsDashboard';

/**
 * Block width in hours for the time-slot charts. The API always returns
 * per-hour rows; the width is applied here, in the browser, so switching it
 * is instant and never refetches the dashboard.
 *
 * Restricted to widths that divide 24 evenly — anything else leaves a ragged
 * final block that silently holds fewer hours than the ones beside it, making
 * the bars incomparable.
 */
export type SlotWidth = 1 | 2 | 3;

/**
 * Blocks are anchored at 6am, not midnight, and the chart reads 6am -> 6am.
 *
 * Maidan's day is an evening business: bookings run from late afternoon
 * through to roughly 6am, and the quiet stretch is the middle of the day.
 * Anchored at midnight, that single busy run gets cut in half and rendered at
 * opposite ends of the chart — the 10pm-midnight block on the far right and
 * its own continuation, midnight-2am, on the far left. Starting the axis at
 * 6am keeps one night in one unbroken run, and it lines up with how the
 * client already talks about the day ("the 6-9 slot").
 */
const DAY_START_HOUR = 6;

export interface SlotBucket {
  /** Stable identity for React keys and chart dataKeys. */
  key: string;
  /** Display label, e.g. "6-9pm", "12-3am", "10pm-1am", or "Unknown". */
  label: string;
  /** First hour in the block (0-23); null for the unparsed-slot bucket. */
  startHour: number | null;
}

/** Every block for a given width, in reading order, 6am -> 6am. */
export function slotBuckets(width: SlotWidth): SlotBucket[] {
  const buckets: SlotBucket[] = [];
  for (let offset = 0; offset < 24; offset += width) {
    const startHour = (DAY_START_HOUR + offset) % 24;
    buckets.push({
      key: String(startHour),
      label: slotLabel(startHour, width),
      startHour,
    });
  }
  return buckets;
}

/** Which block an hour belongs to; null hours map to the Unknown bucket. */
export function bucketKeyForHour(hour: number | null, width: SlotWidth): string {
  if (hour == null || !Number.isInteger(hour) || hour < 0 || hour > 23) return UNKNOWN_KEY;
  const offset = (hour - DAY_START_HOUR + 24) % 24;
  return String((DAY_START_HOUR + Math.floor(offset / width) * width) % 24);
}

export const UNKNOWN_KEY = 'unknown';

/**
 * The Unknown bucket is appended only when it actually holds something.
 * It covers bookings whose free-text slot never parsed — real bookings with
 * no known hour, so they are shown rather than dropped (dropping them would
 * put the chart's total below the Total Bookings KPI on the same page), but
 * an always-present empty "Unknown" bar would just be noise.
 */
export function bucketsForRows(rows: TimeSlotRow[], width: SlotWidth): SlotBucket[] {
  const buckets = slotBuckets(width);
  const hasUnknown = rows.some((r) => r.slot_start_hour == null && r.booking_count > 0);
  if (hasUnknown) buckets.push({ key: UNKNOWN_KEY, label: 'Unknown', startHour: null });
  return buckets;
}

/**
 * "6-9pm" when both ends share a meridiem, "10pm-1am" when they straddle one.
 * Spelling the meridiem once where it's unambiguous keeps the axis labels
 * short enough to sit side by side without rotating them.
 */
function slotLabel(startHour: number, width: SlotWidth): string {
  const end = (startHour + width) % 24;
  const a = hour12(startHour);
  const b = hour12(end);
  return a.meridiem === b.meridiem ? `${a.n}-${b.n}${b.meridiem}` : `${a.n}${a.meridiem}-${b.n}${b.meridiem}`;
}

function hour12(hour: number): { n: number; meridiem: 'am' | 'pm' } {
  const h = ((hour % 24) + 24) % 24;
  return { n: h % 12 === 0 ? 12 : h % 12, meridiem: h < 12 ? 'am' : 'pm' };
}

/** Total bookings per bucket key — the series behind the comparison chart. */
export function countsByBucket(rows: TimeSlotRow[], width: SlotWidth): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKeyForHour(r.slot_start_hour, width);
    out.set(key, (out.get(key) ?? 0) + r.booking_count);
  }
  return out;
}

/** Bookings per bucket key per status — the segments of the stacked chart. */
export function countsByBucketAndStatus(
  rows: TimeSlotRow[],
  width: SlotWidth
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = bucketKeyForHour(r.slot_start_hour, width);
    const byStatus = out.get(key) ?? new Map<string, number>();
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + r.booking_count);
    out.set(key, byStatus);
  }
  return out;
}
