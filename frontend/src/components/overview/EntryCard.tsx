import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export function EntryCard({
  eyebrow,
  title,
  value,
  sub,
  href,
  tone,
  dimmed = false,
  onHoverStart,
  onHoverEnd,
}: {
  eyebrow: string;
  title: string;
  value: string;
  sub: string;
  href: string;
  /** Accent pair from ASK_SCOPES, so this card and the Ask AI starter for the
   *  same dashboard glow in the same colour. */
  tone: { ring: string; glow: string };
  /** Set while a sibling card is hovered, so focus lands on one card at a time. */
  dimmed?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: dimmed ? 0.55 : 1, scale: dimmed ? 0.985 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="min-w-0"
    >
      <Link
        to={href}
        viewTransition
        onPointerEnter={onHoverStart}
        onPointerLeave={onHoverEnd}
        className={cn(
          'group relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface p-5',
          'transition-all duration-200 ease-[var(--ease-maidan)]',
          'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgb(16_24_40/0.28)]',
          tone.ring,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
        )}
      >
        {/* Corner bloom in the dashboard's own accent — same treatment as the
            Ask AI starter cards, pinned to the card rather than tracking the
            cursor. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-7 -top-7 h-20 w-20 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: tone.glow }}
        />

        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{eyebrow}</p>
          <p className="mt-1 font-heading text-lg font-semibold text-ink">{title}</p>
        </div>

        <div className="relative z-10 mt-4">
          <p className="text-sm font-medium tabular-nums text-ink">{value}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
        </div>

        <span className="relative z-10 mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue group-hover:text-blue-bright">
          View report
          <span aria-hidden="true" className="transition-transform duration-200 ease-[var(--ease-maidan)] group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
