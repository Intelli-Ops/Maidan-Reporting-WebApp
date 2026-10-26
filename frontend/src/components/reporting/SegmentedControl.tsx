import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

// iOS/macOS-style segmented control — the shared pill-toggle look used for
// granularity switches and dashboard view tabs.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  dividers = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /**
   * Rule a thin "|" between each option, for a group that reads as several
   * distinct choices (e.g. picking which dataset to import) rather than one
   * continuous toggle (view tabs, granularity) — off by default so existing
   * usages keep their plain pill look.
   */
  dividers?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-full bg-surface-muted p-1', className)}>
      {options.map((opt, i) => (
        <div key={opt.value} className="flex items-center gap-0.5">
          {/* bg-border reads fine on a white card, but is nearly invisible
              against this control's own bg-surface-muted track — a darker,
              translucent ink line is needed for the same divider to actually
              show up here. */}
          {dividers && i > 0 && <span aria-hidden className="h-4 w-px shrink-0 bg-ink/15" />}
          <button
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-maidan)]',
              value === opt.value ? 'bg-blue-soft text-blue' : 'text-ink-muted hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        </div>
      ))}
    </div>
  );
}
