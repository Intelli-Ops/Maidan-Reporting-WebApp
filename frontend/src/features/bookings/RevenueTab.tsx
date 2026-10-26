import { ChartCard } from '@/components/reporting/ChartCard';
import { DataTable } from '@/components/reporting/DataTable';
import { DonutChart } from '@/components/reporting/DonutChart';
import { FacilityShareChart } from '@/components/reporting/FacilityShareChart';
import { GranularityToggle } from '@/components/reporting/GranularityToggle';
import { HorizontalBarChart } from '@/components/reporting/HorizontalBarChart';
import { KpiStrip } from '@/components/reporting/KpiStrip';
import { RevenueTrendChart } from '@/components/reporting/RevenueTrendChart';
import { ValueWithChange } from '@/components/reporting/ValueWithChange';
import { TwoValueSplitBar } from '@/components/reporting/TwoValueSplitBar';
import { formatCompactNumber, formatCurrency, formatPercent, num } from '@/lib/format';
import type { BookingsDashboardData, Granularity } from '@/lib/types/bookingsDashboard';

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function RevenueTab({
  data,
  granularity,
  onGranularityChange,
}: {
  data: BookingsDashboardData;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}) {
  const { kpis, revenueTrend, byFacility, bySport, facilityShareOverTime, discountBurdenByFacility, bankVsMaidanDiscountShare, byPaymentMethod, meta } =
    data;
  const cmp = kpis.comparison;

  return (
    <div className="flex flex-col gap-6">
      <KpiStrip
        items={[
          {
            label: 'Total Bookings',
            value: formatCompactNumber(kpis.total_bookings),
            changePct: cmp?.total_bookings_change_pct ?? undefined,
            tone: 'hero',
          },
          // Accents follow the same reading across all three dashboards: mint
          // for money kept, blue for a neutral magnitude, amber for value
          // given away, red for an outright loss.
          {
            label: 'Net Revenue',
            value: formatCurrency(kpis.total_net_revenue),
            changePct: cmp?.total_net_revenue_change_pct ?? undefined,
            accent: 'mint',
          },
          {
            label: 'Gross Amount',
            value: formatCurrency(kpis.total_gross_amount),
            changePct: cmp?.total_gross_amount_change_pct ?? undefined,
            accent: 'blue',
          },
          {
            label: 'Discount Given',
            value: formatCurrency(kpis.total_discount_amount),
            changePct: cmp?.total_discount_amount_change_pct ?? undefined,
            invert: true,
            accent: 'amber',
          },
          {
            label: 'Cancellation Rate',
            value: formatPercent(kpis.cancellation_rate_pct),
            caption: `${formatCompactNumber(kpis.cancelled_bookings)} cancelled`,
            changePct: cmp?.cancellation_rate_change_pct ?? undefined,
            invert: true,
            accent: 'red',
          },
        ]}
      />

      <ChartCard
        title="Revenue Trend"
        description="Net revenue over the selected period."
        actions={<GranularityToggle value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />}
      >
        <RevenueTrendChart rows={revenueTrend.rows} startDate={meta.filters.startDate} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Revenue by Facility"
          scopeBadge="All facilities"
        >
          <HorizontalBarChart
            data={byFacility.map((f) => ({
              label: f.facility_name,
              value: num(f.net_revenue),
              share: formatPercent(f.gross_share_pct),
              changePct: f.net_revenue_change_pct,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Revenue by Sport"
          scopeBadge="All sports"
        >
          <DonutChart
            centerLabel="Revenue"
            data={bySport.map((s) => ({
              label: s.sport_name,
              value: num(s.net_revenue),
              share: formatPercent(s.revenue_share_pct),
              changePct: s.net_revenue_change_pct,
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Facility Share Over Time"
        description="Weekly net revenue split by facility."
        scopeBadge="All facilities"
      >
        <FacilityShareChart rows={facilityShareOverTime} startDate={meta.filters.startDate} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Discount Burden by Facility"
          description="Discount given as a share of gross bookings."
          scopeBadge="All facilities"
        >
          <DataTable
          gridlines
            columns={[
              { key: 'facility', label: 'Facility', align: 'center', render: (r) => r.facility_name, pill: true },
              { key: 'gross', label: 'Gross', align: 'center', render: (r) => formatCurrency(r.total_gross_amount) },
              {
                key: 'discount',
                label: 'Discount',
                align: 'center',
                render: (r) => formatCurrency(r.total_discount_amount),
              },
              {
                key: 'burden',
                label: 'Burden',
                align: 'center',
                changeSlot: true,
                render: (r) => (
                  <ValueWithChange
                  align="center"
                    value={formatPercent(r.discount_burden_pct)}
                    changePct={r.discount_burden_pct_change_pp}
                    unit="pp"
                    invert
                  />
                ),
              },
            ]}
            rows={discountBurdenByFacility}
            rowKey={(r) => r.facility_id}
          />
        </ChartCard>

        <ChartCard
          title="Bank vs Maidan Discount Share"
          description="Who absorbs card-discount cost, for bookings with a matched bank BIN."
        >
          <TwoValueSplitBar
            a={{ label: 'Bank absorbed', value: num(bankVsMaidanDiscountShare.bank_absorbed_amount), color: '#5DCAA5' }}
            b={{ label: 'Maidan absorbed', value: num(bankVsMaidanDiscountShare.maidan_absorbed_amount), color: '#185FA5' }}
          />
          {num(bankVsMaidanDiscountShare.bank_absorbed_amount) === 0 && num(bankVsMaidanDiscountShare.maidan_absorbed_amount) > 0 && (
            <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-[12px] leading-snug text-ink-muted">
              No bank discount-share agreements are on file for these card BINs yet, so every discount is currently
              attributed to Maidan by default. Populate <code className="text-[11px]">bank_discount_share</code> in{' '}
              <code className="text-[11px]">bank_bin_reference</code> once bank agreements are known.
            </p>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Revenue by Payment Method">
        <DataTable
          gridlines
          columns={[
            { key: 'method', label: 'Payment Method', align: 'center', render: (r) => r.payment_method_name, pill: true },
            { key: 'count', label: 'Bookings', align: 'center', render: (r) => formatCompactNumber(r.booking_count) },
            {
              key: 'revenue',
              label: 'Net Revenue',
              align: 'center',
              changeSlot: true,
              render: (r) => (
                <ValueWithChange align="center" value={formatCurrency(r.net_revenue)} changePct={r.net_revenue_change_pct} />
              ),
            },
          ]}
          rows={byPaymentMethod}
          rowKey={(r) => r.payment_method_id}
        />
      </ChartCard>
    </div>
  );
}
