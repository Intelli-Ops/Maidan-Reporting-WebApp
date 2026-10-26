import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, CHART_MARGIN } from '@/components/reporting/chartAxis';
import { formatCurrency } from '@/lib/format';

export interface PayoutCoverageDatum {
  label: string;
  /** Disbursed as a percentage of that month's profit. */
  ratioPct: number;
  profit: number;
  disbursed: number;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload?: PayoutCoverageDatum }[];
}

// Payouts and profit are already plotted against each other in rupees on the
// Profit vs Disbursement chart, where both lines sit almost on top of one
// another and a month paying out 7% more than it earned looks identical to one
// paying out 3% less. Plotting the RATIO instead makes that gap the whole
// subject of the chart: 100% is break-even, and anything above it is a month
// that paid investors more than the facilities earned.
function CoverageTooltip({ active, label, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="font-heading text-[15px] font-semibold text-ink">{row.ratioPct.toFixed(1)}% of profit paid out</p>
      <p className="mt-1 text-[12px] text-ink-muted">Profit {formatCurrency(row.profit)}</p>
      <p className="text-[12px] text-ink-muted">Disbursed {formatCurrency(row.disbursed)}</p>
    </div>
  );
}

function barColor(ratioPct: number): string {
  if (ratioPct > 105) return '#e15b5b'; // paid out materially more than earned
  if (ratioPct > 100) return '#d9a441'; // marginally over
  return '#5dcaa5';
}

export function PayoutCoverageChart({ data }: { data: PayoutCoverageDatum[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No profit recorded in this range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#DDE3DE' }} tick={AXIS_TICK} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(v) => `${v}%`}
          width={52}
        />
        <Tooltip content={<CoverageTooltip />} cursor={{ fill: '#F0F2EF' }} />
        {/*
          Labelled inside the plot rather than out to the right: `position:
          'right'` draws the text beyond the plot's right edge, where the
          chart margin cannot hold it and it was clipped mid-word.
        */}
        <ReferenceLine
          y={100}
          stroke="#66716B"
          strokeDasharray="4 4"
          label={{
            value: 'Break-even',
            position: 'insideTopRight',
            fontSize: 10,
            fill: '#66716B',
            dy: -4,
          }}
        />
        <Bar dataKey="ratioPct" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={barColor(d.ratioPct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
