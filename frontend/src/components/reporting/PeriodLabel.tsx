import { formatPeriodLabel } from '@/lib/periodLabel';
import { CalendarIcon } from '@/components/ui/icons';

/**
 * The period the dashboard is currently totalling, shown in the page header
 * so it sits above the filter bar and stays in view while reading the KPIs.
 *
 * Rendered as static text, not a control — the date picker in the filter bar
 * below is what changes the period, and a second clickable-looking element
 * saying the same thing invites people to try to edit it here.
 */
export function PeriodLabel({
  startDate,
  endDate,
}: {
  startDate: string | null;
  endDate: string | null;
}) {
  const label = formatPeriodLabel(startDate, endDate);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-1.5">
      <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Period</span>
      {/* aria-live: the label changes when the filter changes but nothing else
          in the header does, so a screen-reader user gets no other signal that
          the whole page now covers a different span of time. */}
      <span aria-live="polite" className="text-sm font-medium tabular-nums text-ink">
        {label}
      </span>
    </div>
  );
}
