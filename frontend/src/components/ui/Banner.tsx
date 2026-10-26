import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'error' | 'warning' | 'info' | 'success';

const variantStyles: Record<Variant, string> = {
  error: 'border-red/30 bg-red/5 text-ink',
  warning: 'border-amber/30 bg-amber/5 text-ink',
  info: 'border-blue/30 bg-blue-soft text-ink',
  success: 'border-mint/30 bg-mint-soft text-ink',
};

const dotStyles: Record<Variant, string> = {
  error: 'bg-red',
  warning: 'bg-amber',
  info: 'bg-blue',
  success: 'bg-mint',
};

export function Banner({
  variant = 'info',
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm leading-relaxed', variantStyles[variant])}
    >
      <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[variant])} />
      <div>{children}</div>
    </div>
  );
}
