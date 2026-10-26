import { useId, useState } from 'react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { AXIS_TICK, CHART_MARGIN, CURRENCY_AXIS_WIDTH } from '@/components/reporting/chartAxis';

export interface TrendBarDatum {
  label: string;
  value: number;
}

// Generic single-series bar-over-time chart — a vertical-bar counterpart to
// RevenueTrendChart, reused wherever a dashboard needs "one currency value
// per period" (investor monthly disbursement, expense trend) rather than a
// per-category breakdown.
//
// Three things carry information rather than decoration, which is what keeps
// the gradient/rounded treatment from being pure chart-junk:
//
//  - the PEAK period is filled mint instead of blue, so the worst month is
//    findable without reading every bar against the axis;
//  - a dashed AVERAGE rule gives every bar a baseline to be judged against,
//    which a bare bar chart makes you eyeball;
//  - hovering focuses one bar and fades the rest, so a dense 12-week range
//    can still be read one period at a time.
export function TrendBarChart({ data, tooltipLabel = 'Amount' }: { data: TrendBarDatum[]; tooltipLabel?: string }) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  const values = data.map((d) => d.value);
  const peak = Math.max(...values);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  // A single bar is its own peak and its own average; flagging it as either
  // says nothing, so both cues are suppressed rather than shown trivially.
  const showPeak = data.length > 1;
  const showAverage = data.length > 1;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        margin={CHART_MARGIN}
        // recharts types activeTooltipIndex as number | TooltipIndex | null,
        // so it's narrowed rather than annotated at the parameter.
        onMouseMove={(state) => {
          const index = state?.activeTooltipIndex;
          setActiveIndex(typeof index === 'number' ? index : null);
        }}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={`${gradientId}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4E9FE0" />
            <stop offset="100%" stopColor="#185FA5" />
          </linearGradient>
          <linearGradient id={`${gradientId}-peak`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86DFC0" />
            <stop offset="100%" stopColor="#5DCAA5" />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: '#DDE3DE' }}
          tick={AXIS_TICK}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(v) => formatCurrency(v)}
          width={CURRENCY_AXIS_WIDTH}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(value as number), tooltipLabel]}
          labelStyle={{ color: '#0B1B14', fontWeight: 600 }}
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)', fontSize: 12 }}
          // The default block cursor re-tints the whole column and fights the
          // fade-the-others treatment below, which is doing the same job.
          cursor={false}
        />

        {showAverage && (
          <ReferenceLine
            y={average}
            stroke="#9BA5A0"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{
              value: `Avg ${formatCurrency(average)}`,
              position: 'insideTopRight',
              fill: '#66716B',
              fontSize: 10,
            }}
          />
        )}

        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          maxBarSize={36}
          animationDuration={700}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell
              key={d.label}
              fill={showPeak && d.value === peak ? `url(#${gradientId}-peak)` : `url(#${gradientId}-base)`}
              fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.32}
              style={{ transition: 'fill-opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
