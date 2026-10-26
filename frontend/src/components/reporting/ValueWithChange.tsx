import type { ReactNode } from 'react';
import { TrendTag } from '@/components/ui/TrendTag';

/**
 * Width reserved for the change badge, plus the gap separating it from the
 * value. Every badge starts at the same x inside this slot, so the badges form
 * their own tidy sub-column instead of ragging with the length of the number
 * beside them.
 *
 * DataTable pads a `changeSlot` column's HEADING by the same total, which is
 * what puts the heading above the value rather than above the badge.
 */
const BADGE_SLOT_PX = 64;
const GAP_PX = 8;
export const CHANGE_SLOT_TOTAL_PX = BADGE_SLOT_PX + GAP_PX;

/**
 * A numeric table cell carrying a period-over-period change badge, on one line.
 *
 * The subtlety is which part of the cell the heading lines up with. Let the
 * badge take the column's right edge and it pushes the number ~70px to the
 * left, so the figure being scanned no longer sits under its own heading.
 * Here the VALUE is anchored to the heading and the badge occupies a fixed
 * slot to its right: the heading doesn't span the whole cell, it just marks
 * the column the value reads down.
 */
export function ValueWithChange({
  value,
  changePct,
  unit,
  invert,
  align = 'right',
}: {
  value: ReactNode;
  changePct?: number | null;
  unit?: string;
  invert?: boolean;
  /** Match the column's alignment — see the layout note below. */
  align?: 'right' | 'center';
}) {
  // Centred columns balance the value and its badge as one group about the
  // column's centre line, so the fixed slot is dropped: reserving badge width
  // on a centred cell would shove the pair off-centre whenever a row has no
  // badge to put in it.
  if (align === 'center') {
    return (
      <span className="flex items-center justify-center" style={{ gap: `${GAP_PX}px` }}>
        <span>{value}</span>
        {changePct != null && <TrendTag changePct={changePct} unit={unit} invert={invert} />}
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end" style={{ gap: `${GAP_PX}px` }}>
      {/* data-value-anchor marks the element the heading aligns to — the UI
          audit measures this instead of the cell's outer edge. */}
      <span data-value-anchor>{value}</span>
      <span className="shrink-0 text-left" style={{ width: `${BADGE_SLOT_PX}px` }}>
        {changePct != null && <TrendTag changePct={changePct} unit={unit} invert={invert} />}
      </span>
    </span>
  );
}
