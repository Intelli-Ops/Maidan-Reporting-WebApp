import type { ReactNode } from 'react';
import { TrendTag } from '@/components/ui/TrendTag';
import { cn } from '@/lib/utils';

/** Fill colors for the optional share bar, keyed to the theme's accent tokens. */
const PROGRESS_TONES = {
  blue: 'bg-blue',
  mint: 'bg-mint',
  amber: 'bg-amber',
  red: 'bg-red',
} as const;

export type ProgressTone = keyof typeof PROGRESS_TONES;

export function Metric({
  label,
  value,
  changePct,
  unit = '%',
  invert = false,
  caption,
  size = 'md',
  tone = 'default',
  progress,
  className,
}: {
  label: string;
  value: ReactNode;
  changePct?: number;
  unit?: string;
  invert?: boolean;
  caption?: string;
  size?: 'md' | 'lg' | 'sm';
  /** 'onDark' for the hero KPI card — flips label/value/caption to white/translucent tones. */
  tone?: 'default' | 'onDark';
  /** Renders a share bar under the value — for metrics that are a portion of a whole. */
  progress?: { pct: number; tone?: ProgressTone };
  className?: string;
}) {
  const onDark = tone === 'onDark';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          onDark ? 'text-white/60' : 'text-ink-faint'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'font-heading font-semibold tracking-tight tabular-nums',
          onDark ? 'text-white' : 'text-ink',
          size === 'lg'
            ? 'text-[34px] leading-none'
            : size === 'sm'
              ? 'text-[19px] leading-tight'
              : 'text-[26px] leading-none'
        )}
      >
        {value}
      </p>
      {progress && (
        <div
          className={cn('h-1.5 w-full overflow-hidden rounded-full', onDark ? 'bg-white/20' : 'bg-ink/[0.07]')}
          role="presentation"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500 ease-[var(--ease-maidan)]',
              onDark ? 'bg-white/80' : PROGRESS_TONES[progress.tone ?? 'blue']
            )}
            style={{ width: `${Math.min(Math.max(progress.pct, 0), 100)}%` }}
          />
        </div>
      )}
      {changePct !== undefined ? (
        <div className="flex items-center gap-1.5">
          <TrendTag changePct={changePct} unit={unit} invert={invert} />
          <span className={cn('text-[11px]', onDark ? 'text-white/50' : 'text-ink-faint')}>
            {caption ?? 'vs previous period'}
          </span>
        </div>
      ) : (
        caption && (
          <p className={cn('text-[12px] leading-snug', onDark ? 'text-white/70' : 'text-ink-muted')}>{caption}</p>
        )
      )}
    </div>
  );
}
