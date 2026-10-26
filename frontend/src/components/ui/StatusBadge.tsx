import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'slate';

const toneStyles: Record<Tone, string> = {
  success: 'bg-mint-soft text-mint',
  warning: 'bg-amber/10 text-amber',
  error: 'bg-red/10 text-red',
  neutral: 'bg-surface-muted text-ink-muted',
  info: 'bg-blue-soft text-blue',
  // Deliberately not blue — used next to columns (e.g. bank name) that
  // already use the blue "info" pill, so a second tier of badge needs its
  // own color or the two blend into one undifferentiated wash of blue.
  slate: 'bg-ink/[0.07] text-ink',
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneStyles[tone]
      )}
    >
      {label}
    </span>
  );
}
