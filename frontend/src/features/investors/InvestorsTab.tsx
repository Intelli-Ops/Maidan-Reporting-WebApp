import { ChartCard } from '@/components/reporting/ChartCard';
import { DataTable } from '@/components/reporting/DataTable';
import { CompletionCell } from '@/components/investors/CompletionCell';
import { ForecastPanel } from '@/components/investors/ForecastPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, num } from '@/lib/format';
import type { InvestorStatus } from '@/lib/types/investorsDashboard';
import type { InvestorsDashboardData } from '@/lib/types/investorsDashboard';
import type { useInvestorsFilters } from '@/features/investors/useInvestorsFilters';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<InvestorStatus, 'success' | 'warning' | 'neutral'> = {
  Completed: 'success',
  'Partially Disbursed': 'warning',
  Pending: 'neutral',
};

// Pending is the one column where a large number is bad news, so it carries
// the only red text in the table — reserved for stakes where the majority of
// the money is still outstanding.
function PendingCell({ pending, investment }: { pending: string | number; investment: string | number }) {
  const total = num(investment);
  const share = total > 0 ? (num(pending) / total) * 100 : 0;

  return (
    <span className={cn('font-heading tabular-nums', share > 50 ? 'font-semibold text-red' : 'text-ink')}>
      {formatCurrency(pending)}
    </span>
  );
}

export function InvestorsTab({
  data,
  controller,
}: {
  data: InvestorsDashboardData;
  controller: ReturnType<typeof useInvestorsFilters>;
}) {
  const { facilityComparison, investors, forecast } = data;

  return (
    <div className="flex flex-col gap-6">
      {/*
        Same purpose as Bookings' "All facilities": say up front which filter a
        section ignores, so a reader never has to work out why changing one
        changed nothing. No "All time" counterpart — this tab hides the Period
        control entirely (see InvestorsFilterBar), so a badge disclaiming a
        filter that isn't on screen only raises the question it meant to answer.
      */}
      <ChartCard
        title="Facility Comparison"
        description="Investment, profit, and payoff progress per facility."
        scopeBadge="All facilities"
      >
        <DataTable
          fixedLayout
          gridlines
          columns={[
            { key: 'facility', label: 'Facility', align: 'center', width: '22%', render: (r) => r.facility_name, pill: true },
            {
              key: 'investment',
              label: 'Investment',
              align: 'center',
              width: '16%',
              render: (r) => formatCurrency(r.investment_amount),
            },
            {
              key: 'profit',
              label: 'Profit',
              align: 'center',
              width: '17%',
              render: (r) => formatCurrency(r.profit_amount),
            },
            {
              key: 'disbursed',
              label: 'Disbursed',
              align: 'center',
              width: '17%',
              render: (r) => formatCurrency(r.disbursed_amount),
            },
            {
              key: 'pending',
              label: 'Pending',
              align: 'center',
              width: '14%',
              render: (r) => <PendingCell pending={r.pending_amount} investment={r.investment_amount} />,
            },
            {
              key: 'completion',
              label: 'Completion',
              align: 'center',
              width: '14%',
              render: (r) => <CompletionCell pct={r.completion_pct} />,
            },
          ]}
          rows={facilityComparison}
          rowKey={(r) => r.facility_id}
        />
      </ChartCard>

      <ChartCard
        title="Investors"
        description="Combined stakes across every matching facility, per investor."
      >
        <DataTable
          fixedLayout
          gridlines
          columns={[
            { key: 'investor', label: 'Investor', align: 'center', width: '19%', render: (r) => r.investor_name, pill: true },
            {
              key: 'investment',
              label: 'Investment',
              align: 'center',
              width: '16%',
              render: (r) => formatCurrency(r.investment_amount),
            },
            {
              key: 'disbursed',
              label: 'Disbursed',
              align: 'center',
              width: '16%',
              render: (r) => formatCurrency(r.disbursed_amount),
            },
            {
              key: 'pending',
              label: 'Pending',
              align: 'center',
              width: '15%',
              render: (r) => <PendingCell pending={r.pending_amount} investment={r.investment_amount} />,
            },
            {
              key: 'completion',
              label: 'Completion',
              align: 'center',
              width: '14%',
              render: (r) => <CompletionCell pct={r.completion_pct} />,
            },
            {
              // Wide enough to hold "Partially Disbursed" on one line — the
              // longest status, and the one nearly every row carries.
              key: 'status',
              label: 'Status',
              align: 'center',
              width: '20%',
              render: (r) => (r.status ? <StatusBadge label={r.status} tone={STATUS_TONE[r.status]} /> : '—'),
            },
          ]}
          rows={investors}
          rowKey={(r) => r.investor_id}
        />
      </ChartCard>

      <ForecastPanel
        forecast={forecast}
        targetMonths={controller.filters.targetMonths}
        trailingMonths={controller.filters.trailingMonths}
        onTargetMonthsChange={controller.setTargetMonths}
        onTrailingMonthsChange={controller.setTrailingMonths}
      />
    </div>
  );
}
