import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

// Repayment progress reads as a bar first and a number second: scanning a
// column of 15 percentages to find who is behind is work, whereas a column of
// bars sorts itself visually. Banding is by how much is still OUTSTANDING,
// since that is the exposure — under 50% repaid means the majority of that
// stake is still owed.
function band(pct: number): { fill: string; text: string } {
  if (pct >= 100) return { fill: 'bg-mint', text: 'text-mint' };
  if (pct >= 50) return { fill: 'bg-blue', text: 'text-ink' };
  return { fill: 'bg-red', text: 'text-red' };
}

export function CompletionCell({ pct }: { pct: string | number | null }) {
  if (pct == null) return <span className="text-ink-faint">—</span>;

  const value = Number(pct);
  if (Number.isNaN(value)) return <span className="text-ink-faint">—</span>;

  const { fill, text } = band(value);

  return (
    // Centred to match the rest of the table; the bar and the percentage share
    // one centre line so the column reads as a single stack.
    <div className="flex flex-col items-center gap-1.5">
      <span className={cn('font-heading text-[13px] font-semibold tabular-nums', text)}>
        {formatPercent(value)}
      </span>
      {/* Capped so the bar stays within the width of the "Completion" heading
          above it — a wider bar starts left of the heading and reads as spill. */}
      <div className="h-1.5 w-full max-w-[76px] overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={cn('h-full rounded-full', fill)}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
