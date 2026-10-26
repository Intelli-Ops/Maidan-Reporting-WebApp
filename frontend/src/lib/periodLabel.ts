// Turns the active date filter into a short human label for the dashboards.
//
// The filter bar shows the CONTROL ("3 months", "Custom") but never the answer
// — a preset resolves to real dates only inside getPresetRange, so nothing on
// screen said which months were actually being totalled. Reading a KPI without
// that is guesswork, and screenshots of the dashboard carried no period at all.
//
// Deliberately month-first: the underlying data lands one month per workbook,
// so months are the unit people reason in. Day-level detail appears only when
// a custom range genuinely doesn't line up with month boundaries — labelling
// 5-20 June as "June 2026" would overstate what the numbers cover.

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Parts {
  y: number;
  m: number; // 1-12
  d: number;
}

/**
 * Parses 'YYYY-MM-DD' by splitting the string rather than via `new Date()`.
 * These values are plain calendar dates with no timezone; `new Date('2026-06-01')`
 * parses as UTC midnight and then reports 31 May in any negative-offset zone,
 * which would label the whole dashboard a month early.
 */
function parseISODate(value: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
}

const isMonthStart = (p: Parts) => p.d === 1;
const isMonthEnd = (p: Parts) => p.d === daysInMonth(p.y, p.m);

/**
 * A label for the period currently being shown.
 *
 *   null / null              -> "Overall"
 *   Jun 1 .. Jun 30 2026     -> "June 2026"
 *   Feb 1 .. Aug 31 2026     -> "Feb – Aug 2026"
 *   Oct 1 2025 .. Aug 31 26  -> "Oct 2025 – Aug 2026"
 *   Jun 5 .. Jun 20 2026     -> "5 – 20 Jun 2026"
 *   Feb 5 .. Aug 20 2026     -> "5 Feb – 20 Aug 2026"
 *
 * A half-filled custom range (one date entered, the other not) is described
 * open-ended rather than silently falling back to "Overall" — the user is
 * mid-edit and the numbers on screen really are unbounded on one side.
 */
export function formatPeriodLabel(startDate: string | null, endDate: string | null): string {
  const start = startDate ? parseISODate(startDate) : null;
  const end = endDate ? parseISODate(endDate) : null;

  if (!start && !end) return 'Overall';

  const dayMonthYear = (p: Parts) => `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
  if (start && !end) return `${dayMonthYear(start)} onwards`;
  if (!start && end) return `Up to ${dayMonthYear(end)}`;
  if (!start || !end) return 'Overall'; // unreachable, narrows the types

  const wholeMonths = isMonthStart(start) && isMonthEnd(end);
  const sameMonth = start.y === end.y && start.m === end.m;

  if (sameMonth) {
    if (wholeMonths) return `${MONTHS_LONG[start.m - 1]} ${start.y}`;
    return `${start.d} – ${end.d} ${MONTHS_SHORT[start.m - 1]} ${start.y}`;
  }

  if (wholeMonths) {
    // Same year: name it once at the end ("Feb – Aug 2026") rather than twice.
    if (start.y === end.y) return `${MONTHS_SHORT[start.m - 1]} – ${MONTHS_SHORT[end.m - 1]} ${start.y}`;
    return `${MONTHS_SHORT[start.m - 1]} ${start.y} – ${MONTHS_SHORT[end.m - 1]} ${end.y}`;
  }

  if (start.y === end.y) {
    return `${start.d} ${MONTHS_SHORT[start.m - 1]} – ${end.d} ${MONTHS_SHORT[end.m - 1]} ${start.y}`;
  }
  return `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
}
