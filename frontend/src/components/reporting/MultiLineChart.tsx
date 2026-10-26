import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { AXIS_TICK, CHART_MARGIN, CURRENCY_AXIS_WIDTH } from '@/components/reporting/chartAxis';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

// Generic multi-series line-over-time chart — reused for the investor
// dashboard's profit-vs-disbursement and remaining-liability trends, where
// two related currency series need to be compared on one timeline.
export function MultiLineChart({
  data,
  series,
}: {
  data: Array<{ label: string } & Record<string, number | string>>;
  series: LineSeries[];
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={CHART_MARGIN}>
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
          formatter={(value, name) => [
            formatCurrency(value as number),
            series.find((s) => s.key === name)?.label ?? name,
          ]}
          labelStyle={{ color: '#0B1B14', fontWeight: 600 }}
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)', fontSize: 12 }}
        />
        <Legend iconType="line" wrapperStyle={{ fontSize: 12, color: '#66716B', paddingTop: 8 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
