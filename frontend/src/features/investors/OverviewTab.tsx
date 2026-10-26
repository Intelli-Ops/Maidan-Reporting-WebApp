import { ChartCard } from '@/components/reporting/ChartCard';
import { HorizontalBarChart } from '@/components/reporting/HorizontalBarChart';
import { KpiStrip } from '@/components/reporting/KpiStrip';
import { MultiLineChart } from '@/components/reporting/MultiLineChart';
import { PayoutCoverageChart } from '@/components/investors/PayoutCoverageChart';
import { formatCurrency, formatMonthLabel, formatPercent, num } from '@/lib/format';
import type { InvestorsDashboardData } from '@/lib/types/investorsDashboard';

export function OverviewTab({ data }: { data: InvestorsDashboardData }) {
  const { kpis, profitByFacility, trends } = data;
  const cmp = kpis.comparison;

  // Remaining liability as a share of what was committed. This has to be
  // derived from the two snapshot figures directly: the obvious-looking
  // `100 - disbursed_pct` is a different quantity, because disbursed_pct is
  // windowed (disbursed_in_range / investment) while remaining_liability is a
  // running balance (investment - disbursed_all_time). With a date range set,
  // that expression reported the share of investment not paid out *during the
  // period* while the rupee figure beside it showed the all-time balance — so
  // the percentage moved with the date filter and the amount above it didn't.
  const totalInvestment = num(kpis.total_investment);
  const remainingLiability = num(kpis.remaining_liability);
  const remainingPct = totalInvestment > 0 ? (remainingLiability / totalInvestment) * 100 : 0;

  // How much of everything still owed sits with the single largest creditor —
  // concentration risk that the bare rupee figure doesn't convey on its own.
  const topPendingShare =
    kpis.highestPendingInvestor && remainingLiability > 0
      ? (num(kpis.highestPendingInvestor.pending_amount) / remainingLiability) * 100
      : 0;

  const payoutCoverage = trends.profitVsDisbursement
    .filter((r) => num(r.profit_amount) > 0)
    .map((r) => ({
      label: formatMonthLabel(r.period_month),
      ratioPct: (num(r.disbursed_amount) / num(r.profit_amount)) * 100,
      profit: num(r.profit_amount),
      disbursed: num(r.disbursed_amount),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <KpiStrip
          items={[
            {
              label: 'Total Disbursed',
              value: formatCurrency(kpis.total_amount_disbursed),
              caption: `${formatPercent(kpis.disbursed_pct)} of total investment`,
              changePct: cmp?.total_amount_disbursed_change_pct ?? undefined,
              tone: 'hero',
              progress: { pct: num(kpis.disbursed_pct) },
              scope: 'period',
            },
            {
              label: 'Total Investment',
              value: formatCurrency(kpis.total_investment),
              caption: 'Committed by all investors to date',
              accent: 'blue',
              scope: 'snapshot',
            },
            {
              label: 'Remaining Liability',
              value: formatCurrency(kpis.remaining_liability),
              caption: `${formatPercent(remainingPct)} of investment still owed`,
              accent: 'amber',
              progress: { pct: remainingPct, tone: 'amber' },
              scope: 'snapshot',
            },
            {
              label: 'Total Profit',
              value: formatCurrency(profitByFacility.total),
              changePct: profitByFacility.total_change_pct ?? undefined,
              accent: 'mint',
              scope: 'period',
            },
            {
              label: 'Highest Pending Investor',
              // A name, not a figure — the rupee amount and its share of the
              // whole liability are what make the card actionable, so they get
              // the caption and the bar rather than being a bare subtitle.
              value: kpis.highestPendingInvestor?.investor_name ?? '—',
              size: 'sm',
              caption: kpis.highestPendingInvestor
                ? `${formatCurrency(kpis.highestPendingInvestor.pending_amount)} · ${formatPercent(
                    topPendingShare
                  )} of all liability`
                : undefined,
              accent: topPendingShare >= 33 ? 'red' : 'blue',
              progress: kpis.highestPendingInvestor
                ? { pct: topPendingShare, tone: topPendingShare >= 33 ? 'red' : 'blue' }
                : undefined,
              scope: 'snapshot',
            },
          ]}
        />
      </div>

      {/*
        The API ships an explanatory note for this section (profit is a
        facility-level pool, so the investor/status filters don't apply to it).
        It's written for an API consumer, not a reader of the page — the
        "All facilities" badge says the same thing in two words.
      */}
      <ChartCard
        title="Profit by Facility"
        description="Total profit generated, broken out per facility."
        scopeBadge="All facilities"
      >
        <HorizontalBarChart
          data={profitByFacility.byFacility.map((f) => ({
            label: f.facility_name,
            value: num(f.total_profit),
            share: f.share_pct != null ? formatPercent(f.share_pct) : undefined,
          }))}
        />
      </ChartCard>

      {/*
        Replaces the old "Monthly Disbursement Trend" bar chart, which plotted
        disbursed rupees per month — the same series the Profit vs Disbursement
        chart directly below already draws, against a more useful baseline.
        Coverage asks something that chart cannot answer at a glance: did this
        month's payout fit inside this month's profit?
      */}
      <ChartCard
        title="Payout Coverage"
        description="Share of each month's profit paid back to investors. Above 100% means more went out than the facilities earned."
      >
        <PayoutCoverageChart data={payoutCoverage} />
      </ChartCard>

      <ChartCard title="Profit vs Disbursement" description="Facility profit generated alongside investor disbursements.">
        <MultiLineChart
          data={trends.profitVsDisbursement.map((r) => ({
            label: formatMonthLabel(r.period_month),
            profit: num(r.profit_amount),
            disbursed: num(r.disbursed_amount),
          }))}
          series={[
            { key: 'profit', label: 'Profit', color: '#5DCAA5' },
            { key: 'disbursed', label: 'Disbursed', color: '#185FA5' },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Remaining Liability Trend"
        description="Cumulative disbursement against total investment commitments."
      >
        <MultiLineChart
          data={trends.remainingLiability.map((r) => ({
            label: formatMonthLabel(r.period_month),
            cumulative: num(r.cumulative_disbursed),
            remaining: num(r.remaining_liability),
          }))}
          series={[
            { key: 'cumulative', label: 'Cumulative Disbursed', color: '#185FA5' },
            { key: 'remaining', label: 'Remaining Liability', color: '#D9A441' },
          ]}
        />
      </ChartCard>
    </div>
  );
}
