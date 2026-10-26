import { useId } from 'react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clampDateLabel, formatCurrency, num } from '@/lib/format';
import { gradientStopsForIndex } from '@/components/reporting/colors';
import { AXIS_TICK, CHART_MARGIN, CURRENCY_AXIS_WIDTH } from '@/components/reporting/chartAxis';
import type { FacilityShareOverTimeRow } from '@/lib/types/bookingsDashboard';

interface RankedTooltipEntry {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

interface RankedTooltipProps {
  active?: boolean;
  label?: string;
  payload?: RankedTooltipEntry[];
}

// Tooltip lists whichever facility earned the most in the hovered week
// first, not the fixed stacking order (which stays constant across bars for
// visual continuity but says nothing about which facility "won" that week).
function RankedTooltip({ active, label, payload }: RankedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  return (
    <div
      className="rounded-xl bg-surface px-3.5 py-2.5 text-xs"
      style={{ boxShadow: '0 4px 12px rgb(16 24 40 / 0.12)' }}
    >
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      <div className="flex flex-col gap-1">
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.dataKey}
            </span>
            <span className="font-heading font-semibold text-ink">{formatCurrency(Number(entry.value) || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FacilityShareChart({ rows, startDate }: { rows: FacilityShareOverTimeRow[]; startDate?: string | null }) {
  const gradientId = useId();

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">No data in this period.</p>;
  }

  type WeekRow = { label: string; [facilityCode: string]: string | number };

  const facilityCodes = [...new Set(rows.map((r) => r.facility_code))];
  const byWeek = new Map<string, WeekRow>();
  for (const r of rows) {
    const entry = byWeek.get(r.week_start) ?? { label: clampDateLabel(r.week_start, startDate) };
    entry[r.facility_code] = num(r.net_revenue);
    byWeek.set(r.week_start, entry);
  }
  const data = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <defs>
          {facilityCodes.map((code, i) => {
            const [light, dark] = gradientStopsForIndex(i);
            return (
              <linearGradient key={code} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={light} />
                <stop offset="100%" stopColor={dark} />
              </linearGradient>
            );
          })}
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: '#DDE3DE' }}
          tick={AXIS_TICK}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(v) => formatCurrency(v)}
          width={CURRENCY_AXIS_WIDTH}
        />
        <Tooltip content={<RankedTooltip />} cursor={{ fill: '#F0F2EF' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#66716B', paddingTop: 8 }}
        />
        {facilityCodes.map((code, i) => (
          <Bar
            key={code}
            dataKey={code}
            stackId="facility"
            fill={`url(#${gradientId}-${i})`}
            radius={[4, 4, 4, 4]}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
