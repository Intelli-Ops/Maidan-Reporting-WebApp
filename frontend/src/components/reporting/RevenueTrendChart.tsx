import { useId } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clampDateLabel, formatCurrency, num } from '@/lib/format';
import type { RevenueTrendRow } from '@/lib/types/bookingsDashboard';
import { AXIS_TICK, CHART_MARGIN_WIDE, CURRENCY_AXIS_WIDTH } from '@/components/reporting/chartAxis';

interface TrendTooltipEntry {
  dataKey?: string | number;
  value?: number | string;
}

interface TrendTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TrendTooltipEntry[];
}

// Area and Line both plot dataKey="net_revenue" (the Area is just a
// gradient fill under the same series), so Recharts' default tooltip would
// list "Net revenue" twice — once per graphical element. Dedupe by taking
// the first matching entry instead of rendering the whole payload.
function TrendTooltip({ active, label, payload }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const net = payload.find((p) => p.dataKey === 'net_revenue');
  if (!net) return null;

  return (
    <div className="rounded-xl bg-surface px-3.5 py-2.5 text-xs" style={{ boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)' }}>
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-muted">Net revenue</span>
        <span className="font-heading font-semibold text-ink">{formatCurrency(Number(net.value) || 0)}</span>
      </div>
    </div>
  );
}

export function RevenueTrendChart({ rows, startDate }: { rows: RevenueTrendRow[]; startDate?: string | null }) {
  const gradientId = useId();
  const data = rows.map((r) => ({
    label: clampDateLabel(r.period, startDate),
    net_revenue: num(r.net_revenue),
  }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No bookings in this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={CHART_MARGIN_WIDE}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#185FA5" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#185FA5" stopOpacity={0} />
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
        <Tooltip content={<TrendTooltip />} />
        <Area
          type="natural"
          dataKey="net_revenue"
          stroke="none"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
        <Line
          type="natural"
          dataKey="net_revenue"
          stroke="#185FA5"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
