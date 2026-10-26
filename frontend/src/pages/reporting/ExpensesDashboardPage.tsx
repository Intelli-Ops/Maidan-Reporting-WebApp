import { useSearchParams } from 'react-router-dom';
import { AskDock } from '@/components/ai/AskDock';
import { PageHeader } from '@/components/layout/PageHeader';
import { PeriodLabel } from '@/components/reporting/PeriodLabel';
import { SegmentedControl } from '@/components/reporting/SegmentedControl';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExpensesFilterBar } from '@/features/expenses/ExpensesFilterBar';
import { useExpensesFilters } from '@/features/expenses/useExpensesFilters';
import { useExpensesDashboard } from '@/features/expenses/useExpensesDashboard';
import { OverviewTab } from '@/features/expenses/OverviewTab';
import { CategoriesTab } from '@/features/expenses/CategoriesTab';
import { cn } from '@/lib/utils';

type View = 'overview' | 'categories';

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'categories', label: 'Categories' },
];

export function ExpensesDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'categories' ? 'categories' : 'overview';

  const controller = useExpensesFilters();
  const { data, isLoading, isFetching, isError, refetch } = useExpensesDashboard(controller.queryParams);

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

  const activeFacilityFilter = controller.filters.facilityIds.length > 0;
  const activeCategoryOrSubcategoryFilter =
    controller.filters.categoryIds.length > 0 || controller.filters.subcategoryIds.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Expenses"
        description="Where the money is going."
        actions={<PeriodLabel startDate={controller.filters.startDate} endDate={controller.filters.endDate} />}
      />

      <div className="mb-6">
        <ExpensesFilterBar controller={controller} />
      </div>

      <div className="mb-6 w-fit">
        <SegmentedControl value={view} onChange={setView} options={VIEW_OPTIONS} />
      </div>

      {isLoading && <DashboardSkeleton />}
      {isError && !isLoading && <ErrorState onRetry={refetch} />}
      {data && (
        <div className={cn('transition-opacity duration-150', isFetching && 'opacity-60')}>
          {view === 'overview' ? (
            <OverviewTab
              data={data}
              activeFacilityFilter={activeFacilityFilter}
              granularity={controller.filters.granularity}
              onGranularityChange={controller.setGranularity}
            />
          ) : (
            <CategoriesTab
              data={data}
              activeCategoryOrSubcategoryFilter={activeCategoryOrSubcategoryFilter}
              granularity={controller.filters.granularity}
              onGranularityChange={controller.setGranularity}
            />
          )}
        </div>
      )}

      <AskDock scope="expenses" />
    </div>
  );
}
