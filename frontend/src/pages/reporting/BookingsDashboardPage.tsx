import { useSearchParams } from 'react-router-dom';
import { AskDock } from '@/components/ai/AskDock';
import { PageHeader } from '@/components/layout/PageHeader';
import { PeriodLabel } from '@/components/reporting/PeriodLabel';
import { SegmentedControl } from '@/components/reporting/SegmentedControl';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { BookingsFilterBar } from '@/features/bookings/BookingsFilterBar';
import { useBookingsFilters } from '@/features/bookings/useBookingsFilters';
import { useBookingsDashboard } from '@/features/bookings/useBookingsDashboard';
import { RevenueTab } from '@/features/bookings/RevenueTab';
import { PatternsTab } from '@/features/bookings/PatternsTab';
import { TimeSlotsTab } from '@/features/bookings/TimeSlotsTab';
import type { BookingsView } from '@/lib/datePresets';
import { cn } from '@/lib/utils';

// Shared with BOOKINGS_RANGE_LIMITS rather than redeclared: each tab accepts
// a different custom range, and a local copy of this union silently drifts
// from the table that enforces it.
type View = BookingsView;

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'patterns', label: 'Patterns' },
  { value: 'slots', label: 'Time Slots' },
];

const VIEW_KEYS = new Set<string>(VIEW_OPTIONS.map((o) => o.value));

export function BookingsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: View = rawView && VIEW_KEYS.has(rawView) ? (rawView as View) : 'revenue';

  const controller = useBookingsFilters();
  const { data, isLoading, isFetching, isError, refetch } = useBookingsDashboard(controller.queryParams, view);

  function setView(next: View) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('view', next);
        return params;
      },
      { replace: true }
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Bookings"
        description="Where the business is growing."
        actions={<PeriodLabel startDate={controller.filters.startDate} endDate={controller.filters.endDate} />}
      />

      <div className="mb-6">
        <BookingsFilterBar controller={controller} view={view} />
      </div>

      <div className="mb-6 w-fit">
        <SegmentedControl value={view} onChange={setView} options={VIEW_OPTIONS} />
      </div>

      {isLoading && <DashboardSkeleton />}
      {isError && !isLoading && <ErrorState onRetry={refetch} />}
      {/* The query is held back until the custom range is complete and valid
          for this tab (see useBookingsDashboard). Also reachable by switching
          Revenue -> Patterns while a 6-month range is selected, which Patterns
          doesn't accept — so the message names the tab's own limit. */}
      {!data && !isLoading && !isError && (
        <div className="card-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-muted">
            {view === 'patterns'
              ? 'Patterns needs a range between 1 and 3 months. Pick one above to load this tab.'
              : 'Pick a date range of up to 6 months to load the dashboard.'}
          </p>
        </div>
      )}
      {data && (
        <div className={cn('transition-opacity duration-150', isFetching && 'opacity-60')}>
          {view === 'revenue' && (
            <RevenueTab
              data={data}
              granularity={controller.filters.granularity}
              onGranularityChange={controller.setGranularity}
            />
          )}
          {view === 'patterns' && <PatternsTab data={data} />}
          {view === 'slots' && <TimeSlotsTab data={data} />}
        </div>
      )}

      <AskDock scope="bookings" />
    </div>
  );
}
