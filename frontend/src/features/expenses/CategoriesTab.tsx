import { CategoryHeatmap } from '@/components/reporting/CategoryHeatmap';
import { ChartCard } from '@/components/reporting/ChartCard';
import { DataTable } from '@/components/reporting/DataTable';
import { DonutChart } from '@/components/reporting/DonutChart';
import { GranularityToggle } from '@/components/reporting/GranularityToggle';
import { ValueWithChange } from '@/components/reporting/ValueWithChange';
import { formatCompactNumber, formatCurrency, formatPercent, num } from '@/lib/format';
import type { ExpenseGranularity, ExpensesDashboardData } from '@/lib/types/expensesDashboard';

const GRANULARITY_OPTIONS: { value: ExpenseGranularity; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function CategoriesTab({
  data,
  activeCategoryOrSubcategoryFilter,
  granularity,
  onGranularityChange,
}: {
  data: ExpensesDashboardData;
  activeCategoryOrSubcategoryFilter: boolean;
  granularity: ExpenseGranularity;
  onGranularityChange: (g: ExpenseGranularity) => void;
}) {
  const { byCategory, categoryShareOverTime, likeForLikeMonth, meta } = data;

  return (
    <div className="flex flex-col gap-6">
      <ChartCard title="Expenses by Category" description="Rolled up to top-level category.">
        <DonutChart
          centerLabel="Total Spend"
          data={byCategory.map((c) => ({
            label: c.category_name,
            value: num(c.total_amount),
            share: c.share_pct != null ? formatPercent(c.share_pct) : undefined,
          }))}
        />
      </ChartCard>

      <ChartCard title="Category Breakdown">
        <DataTable
          gridlines
          columns={[
            { key: 'category', label: 'Category', align: 'center', render: (r) => r.category_name, pill: true },
            { key: 'count', label: 'Transactions', align: 'center', render: (r) => formatCompactNumber(r.expense_count) },
            {
              key: 'amount',
              label: 'Amount',
              align: 'center',
              changeSlot: true,
              render: (r) => (
                <ValueWithChange
                  align="center"
                  value={formatCurrency(r.total_amount)}
                  changePct={r.total_amount_change_pct}
                  invert
                />
              ),
            },
            { key: 'share', label: 'Share', align: 'center', render: (r) => formatPercent(r.share_pct) },
          ]}
          rows={byCategory}
          rowKey={(r) => r.top_category_id}
        />
      </ChartCard>

      <ChartCard
        title="Category Spend Over Time"
        description={`Every top-level category by ${categoryShareOverTime.granularity === 'monthly' ? 'month' : 'week'} — darker means more spend.`}
        caption={activeCategoryOrSubcategoryFilter ? meta.filterObedience.categoryShareOverTime : undefined}
        actions={<GranularityToggle value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />}
      >
        <CategoryHeatmap rows={categoryShareOverTime.rows} granularity={categoryShareOverTime.granularity} />
      </ChartCard>

      <ChartCard title="Like-for-Like Month Comparison" description="Every occurrence of a calendar month, across consecutive years.">
        <DataTable
          gridlines
          columns={[
            { key: 'month', label: 'Month', align: 'center', render: (r) => r.month_name, pill: true },
            { key: 'year', label: 'Year', align: 'center', render: (r) => String(r.year) },
            { key: 'count', label: 'Transactions', align: 'center', render: (r) => formatCompactNumber(r.expense_count) },
            { key: 'amount', label: 'Amount', align: 'center', render: (r) => formatCurrency(r.total_amount) },
          ]}
          rows={likeForLikeMonth}
          rowKey={(r) => `${r.year}-${r.month_number}`}
        />
      </ChartCard>
    </div>
  );
}
