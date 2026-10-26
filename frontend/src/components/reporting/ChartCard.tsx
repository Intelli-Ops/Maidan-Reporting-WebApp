import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function ChartCard({
  title,
  description,
  scopeBadge,
  scopeBadges,
  caption,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  /**
   * Always-visible marker for sections that don't respect one of the page's
   * filters (e.g. "All facilities"), so it reads at a glance even when that
   * filter isn't currently applied — not just after the fact via `caption`.
   */
  scopeBadge?: string;
  /** Several at once, for a section that ignores more than one filter. */
  scopeBadges?: string[];
  /** Shown when this section ignores one of the active filters (from the API's own meta.filterObedience text). */
  caption?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card-surface p-7', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
            {[...(scopeBadge ? [scopeBadge] : []), ...(scopeBadges ?? [])].map((b) => (
              <StatusBadge key={b} label={b} tone="info" />
            ))}
          </div>
          {description && <p className="mt-1 text-[13px] text-ink-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
      {caption && (
        <p className="mt-4 border-t border-black/[0.04] pt-3 text-[11px] leading-snug text-ink-faint">{caption}</p>
      )}
    </div>
  );
}
