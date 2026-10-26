export type DatePresetKey =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'quarter'
  | 'last_1_month'
  | 'last_2_months'
  | 'last_3_months'
  | 'custom';

// One preset set for all three dashboards (Bookings, Expenses, Investors).
//
// "1 / 2 / 3 months" mean the last N COMPLETE CALENDAR months, and never
// include the month in progress. Every source here — bookings, expenses,
// investor disbursements — lands a month or more in arrears, so any window
// ending "today" finishes inside a stretch with no data and the dashboard
// looks broken. Complete months also make the label honest: on 12 Aug,
// "1 month" is exactly July — not 13 Jul to 12 Aug.
export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: 'last_1_month', label: '1 month' },
  { key: 'last_2_months', label: '2 months' },
  { key: 'last_3_months', label: '3 months' },
  { key: 'custom', label: 'Custom' },
];

export const DEFAULT_DATE_PRESET: DatePresetKey = 'last_3_months';

// Presets no longer offered anywhere (they predate the complete-month set, and
// old bookmarks/links still carry them in the URL). Mapped to the nearest valid
// preset rather than ignored, so a stale link still lands on a working view
// instead of an empty one.
export const RETIRED_PRESETS: Record<string, DatePresetKey> = {
  today: 'last_1_month',
  this_week: 'last_1_month',
  this_month: 'last_1_month',
  last_month: 'last_1_month',
  quarter: 'last_3_months',
};

/** Resolves a raw `?preset=` value (possibly retired or absent) to a live one. */
export function resolvePreset(raw: string | null): DatePresetKey {
  return (raw && RETIRED_PRESETS[raw]) || (raw as DatePresetKey | null) || DEFAULT_DATE_PRESET;
}

export type BookingsView = 'revenue' | 'patterns' | 'slots';

// Custom-range limits differ per tab because the tabs ask different questions.
//
// Revenue reports totals, which are meaningful over any window — a single
// day's takings is a legitimate thing to look up.
//
// Patterns compares each weekday against the preceding period, which needs
// several of that weekday on BOTH sides to mean anything. Under a month it
// silently produces nothing: pick one Saturday and the preceding period is the
// day before, a Friday, containing zero Saturdays — so every Change cell comes
// back empty. One month gives 4-5 of each weekday, three months gives 13.
//
// Time Slots takes the same window as Revenue. It counts bookings per slot
// rather than comparing weekday against weekday, so a short range stays
// meaningful — "only 10 days of August" is a question it can answer, and the
// client asks it that way.
export const BOOKINGS_RANGE_LIMITS: Record<BookingsView, { minDays: number; maxDays: number }> = {
  revenue: { minDays: 1, maxDays: 186 }, // up to ~6 months
  patterns: { minDays: 28, maxDays: 93 }, // 1 to 3 months
  slots: { minDays: 1, maxDays: 186 }, // up to ~6 months
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getPresetRange(key: DatePresetKey): { startDate: string; endDate: string } | null {
  const now = new Date();

  switch (key) {
    case 'today': {
      return { startDate: toDateStr(now), endDate: toDateStr(now) };
    }
    case 'this_week': {
      const diffToMonday = (now.getDay() + 6) % 7; // getDay(): 0=Sun
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      return { startDate: toDateStr(monday), endDate: toDateStr(now) };
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toDateStr(first), endDate: toDateStr(now) };
    }
    case 'last_month': {
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toDateStr(firstOfLast), endDate: toDateStr(lastOfLast) };
    }
    case 'quarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(now.getFullYear(), quarterStartMonth, 1);
      return { startDate: toDateStr(first), endDate: toDateStr(now) };
    }
    // The last N COMPLETE calendar months, always ending on the last day of
    // last month — the month in progress is never included. See the comment on
    // BOOKINGS_DATE_PRESETS.
    case 'last_1_month':
      return completeMonthsBack(now, 1);
    case 'last_2_months':
      return completeMonthsBack(now, 2);
    case 'last_3_months':
      return completeMonthsBack(now, 3);

    case 'custom':
      return null;
  }
}

// e.g. on 12 Aug 2026: n=1 -> Jul 1..Jul 31, n=3 -> May 1..Jul 31.
function completeMonthsBack(now: Date, n: number): { startDate: string; endDate: string } {
  // Day 0 of the current month is the last day of the previous month.
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const start = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return { startDate: toDateStr(start), endDate: toDateStr(end) };
}

/** Inclusive day count of a range, for validating custom Bookings ranges. */
export function rangeLengthDays(startDate: string, endDate: string): number {
  const s = new Date(`${startDate}T00:00:00Z`).getTime();
  const e = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

/**
 * Why a custom Bookings range is rejected for this tab, or null when it's
 * fine. Returns a user-facing sentence rather than a code — the picker shows
 * it verbatim.
 */
export function validateBookingsRange(
  startDate: string | null,
  endDate: string | null,
  view: BookingsView
): string | null {
  if (!startDate || !endDate) return null; // still being filled in
  const { minDays, maxDays } = BOOKINGS_RANGE_LIMITS[view];
  const days = rangeLengthDays(startDate, endDate);

  if (days === 0) return 'End date must be after the start date.';
  if (days < minDays) {
    return `The Patterns tab needs at least 1 month: ${days} day${days === 1 ? '' : 's'} is too short to compare weekdays.`;
  }
  if (days > maxDays) {
    const cap = view === 'patterns' ? '3 months' : '6 months';
    return `Pick at most ${cap}; that range is ${days} days.`;
  }
  return null;
}
