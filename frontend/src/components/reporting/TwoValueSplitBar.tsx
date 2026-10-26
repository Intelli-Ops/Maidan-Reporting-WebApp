import { formatCurrency } from '@/lib/format';

export function TwoValueSplitBar({
  a,
  b,
}: {
  a: { label: string; value: number; color: string };
  b: { label: string; value: number; color: string };
}) {
  const total = a.value + b.value || 1;
  const aPct = (a.value / total) * 100;

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{a.label}</p>
          <p className="mt-1.5 font-heading text-[26px] font-semibold leading-none text-ink tabular-nums">
            {formatCurrency(a.value)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{b.label}</p>
          <p className="mt-1.5 font-heading text-[26px] font-semibold leading-none text-ink tabular-nums">
            {formatCurrency(b.value)}
          </p>
        </div>
      </div>
      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <div style={{ width: `${aPct}%`, backgroundColor: a.color }} />
        <div style={{ width: `${100 - aPct}%`, backgroundColor: b.color }} />
      </div>
    </div>
  );
}
