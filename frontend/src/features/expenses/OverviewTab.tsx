import { ChartCard } from '@/components/reporting/ChartCard';
import { DataTable } from '@/components/reporting/DataTable';
import { GranularityToggle } from '@/components/reporting/GranularityToggle';
import { HorizontalBarChart } from '@/components/reporting/HorizontalBarChart';
import { KpiStrip } from '@/components/reporting/KpiStrip';
import { TrendBarChart } from '@/components/reporting/TrendBarChart';
import { TwoValueSplitBar } from '@/components/reporting/TwoValueSplitBar';
import { formatCompactNumber, formatCurrency, formatDateLabel, formatMonthLabel, formatPercent, num } from '@/lib/format';
import type { ExpenseGranularity, ExpensesDashboardData } from '@/lib/types/expensesDashboard';

const GRANULARITY_OPTIONS: { value: ExpenseGranularity; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function OverviewTab({
  data,
  activeFacilityFilter,
  granularity,
  onGranularityChange,
}: {
  data: ExpensesDashboardData;
  activeFacilityFilter: boolean;
  granularity: ExpenseGranularity;
  onGranularityChange: (g: ExpenseGranularity) => void;
}) {
  const { kpis, byFacility, expenseTrend, byPaymentMethod, meta } = data;
  const cmp = kpis.comparison;

  return (
    <div className="flex flex-col gap-6">
      <KpiStrip
        items={[
          {
            label: 'Total Expense Amount',
            value: formatCurrency(kpis.total_expense_amount),
            changePct: kpis.delta.deltaPct ?? undefined,
            invert: true,
            caption: `vs ${formatCurrency(kpis.delta.previousPeriod.totalAmount)} prior period`,
            tone: 'hero',
          },
          {
            // Inverted for the same reason as Total Expense Amount above: on
            // a spend dashboard, less expense activity is the good outcome,
            // so a drop reads green. Without this the two cards contradicted
            // each other — the same month could show falling spend in green
            // next to falling transactions in red.
            label: 'Transactions',
            value: formatCompactNumber(kpis.total_transactions),
            changePct: cmp?.total_transactions_change_pct ?? undefined,
            invert: true,
            accent: 'blue',
          },
          // Cash and non-cash are two halves of one split, not a good half
          // and a bad half, so they take the two neutral accents (mint,
          // blue) and each carries a share bar — the pair reads as a
          // composition rather than as a pass/fail.
          {
            label: 'Cash Share',
            value: formatPercent(kpis.cash_pct),
            caption: formatCurrency(kpis.cash_amount),
            changePct: cmp?.cash_pct_change_pp ?? undefined,
            unit: 'pp',
            accent: 'mint',
            progress: { pct: num(kpis.cash_pct), tone: 'mint' },
          },
          {
            label: 'Non-Cash Share',
            value: formatPercent(kpis.non_cash_pct),
            caption: formatCurrency(kpis.non_cash_amount),
            changePct: cmp?.non_cash_pct_change_pp ?? undefined,
            unit: 'pp',
            accent: 'blue',
            progress: { pct: num(kpis.non_cash_pct), tone: 'blue' },
          },
          {
            label: 'Top Facility',
            value: kpis.topFacility?.facilityName ?? '—',
            size: 'sm',
            caption: kpis.topFacility ? formatCurrency(kpis.topFacility.totalAmount) : undefined,
            accent: 'amber',
          },
        ]}
      />

      <ChartCard
        title="Expense Trend"
        description={`Total spend by ${expenseTrend.granularity === 'monthly' ? 'month' : 'week'}.`}
        actions={<GranularityToggle value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />}
      >
        <TrendBarChart
          data={expenseTrend.rows.map((r) => ({
            label: expenseTrend.granularity === 'monthly' ? formatMonthLabel(r.period) : formatDateLabel(r.period),
            value: num(r.total_amount),
          }))}
          tooltipLabel="Expense"
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Expenses by Facility"
          caption={activeFacilityFilter ? meta.filterObedience.byFacility : undefined}
        >
          <HorizontalBarChart
            data={byFacility.map((f) => ({
              label: f.facility_name,
              value: num(f.total_amount),
              share: f.share_pct != null ? formatPercent(f.share_pct) : undefined,
            }))}
          />
        </ChartCard>

        <ChartCard title="Cash vs Non-Cash" description="Share of expenses paid in cash versus cheque/bank.">
          <TwoValueSplitBar
            a={{ label: 'Cash', value: num(kpis.cash_amount), color: '#5DCAA5' }}
            b={{ label: 'Non-Cash', value: num(kpis.non_cash_amount), color: '#185FA5' }}
          />
        </ChartCard>
      </div>

      <ChartCard title="Expenses by Payment Method">
        <DataTable
          gridlines
          columns={[
            { key: 'method', label: 'Payment Method', align: 'center', render: (r) => r.payment_method_name, pill: true },
            { key: 'count', label: 'Transactions', align: 'center', render: (r) => formatCompactNumber(r.expense_count) },
            { key: 'amount', label: 'Amount', align: 'center', render: (r) => formatCurrency(r.total_amount) },
          ]}
          rows={byPaymentMethod}
          rowKey={(r) => r.payment_method_id}
        />
      </ChartCard>
    </div>
  );
}
