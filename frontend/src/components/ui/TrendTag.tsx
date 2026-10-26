import { cn } from '@/lib/utils';

export function TrendTag({
  changePct,
  unit = '%',
  invert = false,
  className,
}: {
  changePct: number;
  unit?: string;
  /** Set for metrics where a decrease is the good outcome (e.g. cancellation rate, expenses) — flips the color without flipping the arrow direction. */
  invert?: boolean;
  className?: string;
}) {
  const up = changePct >= 0;
  const good = invert ? !up : up;

  return (
    <span
      className={cn(
        // whitespace-nowrap: the arrow and the number are one token to the
        // reader, but they're separated by a space, so a narrow column (the
        // weekday chart's fixed 76px Change column) breaks a 3-digit value
        // like "131.3%" onto a second line under the arrow.
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        // One pill treatment everywhere, including on the dark hero cards.
        // Those used to get their own variant that tinted the positive state
        // `text-mint` and the negative a neutral `text-white/70` — on a card
        // whose background is already a blue-to-green gradient, the positive
        // dissolved into the backdrop and the negative never signalled "bad"
        // at all, leaving the arrow to carry it alone. A pale fill reads as a
        // distinct chip against a saturated gradient (where a saturated chip
        // would fight it) and keeps red unmissable.
        good ? 'bg-mint-soft text-mint-deep' : 'bg-red-soft text-red',
        className
      )}
    >
      {up ? '↑' : '↓'} {Math.abs(changePct)}
      {unit}
    </span>
  );
}
