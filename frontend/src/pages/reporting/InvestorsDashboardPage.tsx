import { useSearchParams } from 'react-router-dom';
import { AskDock } from '@/components/ai/AskDock';
import { PageHeader } from '@/components/layout/PageHeader';
import { PeriodLabel } from '@/components/reporting/PeriodLabel';
import { SegmentedControl } from '@/components/reporting/SegmentedControl';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { InvestorsFilterBar } from '@/features/investors/InvestorsFilterBar';
import type { InvestorsView } from '@/features/investors/useInvestorsFilters';
import { useInvestorsFilters } from '@/features/investors/useInvestorsFilters';
import { useInvestorsDashboard } from '@/features/investors/useInvestorsDashboard';
import { OverviewTab } from '@/features/investors/OverviewTab';
import { InvestorsTab } from '@/features/investors/InvestorsTab';
import { cn } from '@/lib/utils';

type View = InvestorsView;

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'investors', label: 'Investors' },
];

export function InvestorsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'investors' ? 'investors' : 'overview';

  const controller = useInvestorsFilters();
  const { data, isLoading, isFetching, isError, refetch } = useInvestorsDashboard(controller.queryParams);

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
      {/* Only on Overview. The Investors tab reports lifetime positions and
          hides the date control entirely (see InvestorsFilterBar), so a period
          badge there would name a range that nothing on screen is filtered by. */}
      <PageHeader
        eyebrow="Reporting"
        title="Investors"
        description="Where the money is coming from, and going."
        actions={
          view === 'overview' ? (
            <PeriodLabel startDate={controller.filters.startDate} endDate={controller.filters.endDate} />
          ) : undefined
        }
      />

      <div className="mb-6">
        <InvestorsFilterBar controller={controller} view={view} />
      </div>

      <div className="mb-6 w-fit">
        <SegmentedControl value={view} onChange={setView} options={VIEW_OPTIONS} />
      </div>

      {isLoading && <DashboardSkeleton />}
      {isError && !isLoading && <ErrorState onRetry={refetch} />}
      {data && (
        <div className={cn('transition-opacity duration-150', isFetching && 'opacity-60')}>
          {view === 'overview' ? (
            <OverviewTab data={data} />
          ) : (
            <InvestorsTab data={data} controller={controller} />
          )}
        </div>
      )}

      <AskDock scope="investors" />
    </div>
  );
}
