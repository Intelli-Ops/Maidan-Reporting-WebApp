// Postgres NUMERIC columns come back from the API as strings (see
// lib/types/bookingsDashboard.ts) — these helpers are the one place that
// safely coerces them, so charts/tables never do ad hoc parseFloat calls.

export function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: string | number | null | undefined, currency = 'PKR'): string {
  const n = num(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toFixed(0)}`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: string | number | null | undefined, decimals = 1): string {
  if (value == null) return '—';
  return `${num(value).toFixed(decimals)}%`;
}

// API DATE columns are serialized as full ISO datetimes with a real
// timezone footgun (see lib/types/bookingsDashboard.ts header comment) —
// always take the date portion verbatim rather than re-parsing with `new
// Date(...)`, which would re-apply the browser's local timezone on top of
// whatever shift already happened server-side.
export function apiDate(iso: string): string {
  return iso.slice(0, 10);
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDateLabel(iso: string): string {
  const [, month, day] = apiDate(iso).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}

// Trend buckets (week/month) are truncated down to the start of their
// calendar period (date_trunc), which can land before the user's selected
// start date — e.g. a "this month" filter of Jun 1-30 still buckets Jun 1-7
// bookings under the Monday-start week of May 26. The bucket's totals only
// ever include in-range bookings (the WHERE clause already excludes May),
// so labeling it "May 26" is misleading. Clamp the displayed label to the
// filter's actual start date instead of the raw bucket date.
export function clampDateLabel(iso: string, minIso: string | null | undefined): string {
  if (minIso && apiDate(iso) < apiDate(minIso)) return formatDateLabel(minIso);
  return formatDateLabel(iso);
}

export function formatMonthYear(iso: string): string {
  const [year, month] = apiDate(iso).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function formatMonthLabel(iso: string): string {
  const [year, month] = apiDate(iso).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} '${String(year).slice(2)}`;
}

export function formatDateWithYear(iso: string): string {
  const [year, month, day] = apiDate(iso).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}, ${year}`;
}
