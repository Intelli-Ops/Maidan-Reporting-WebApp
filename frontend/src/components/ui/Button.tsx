import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'default' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Kept separate from variantStyles rather than folded into a className
// override at the call site — this project's `cn` is plain clsx with no
// class-merge, so two conflicting size utilities (e.g. a caller's `h-8 w-8
// p-0` fighting this component's own `h-12 px-4`) silently pick whichever
// wins the cascade, not whichever appears last in the string. That once
// starved an icon-only button of all its width (px-4 ate the full 32px),
// collapsing the icon to 0px. A dedicated size map can't collide with itself.
const sizeStyles: Record<Size, string> = {
  default: 'h-12 gap-2 px-4 text-[14.5px] font-semibold',
  icon: 'h-8 w-8 p-0',
};

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[linear-gradient(135deg,#185FA5,#3B6D11)] text-white shadow-[0_10px_24px_rgba(24,95,165,0.22)] ' +
    'hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(24,95,165,0.3)] active:translate-y-0 active:scale-[0.99] ' +
    'disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_24px_rgba(24,95,165,0.22)]',
  secondary:
    'bg-surface text-ink border border-border hover:bg-surface-muted active:bg-surface-muted disabled:opacity-50',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50',
  danger:
    'bg-red text-white shadow-[0_10px_24px_rgba(225,91,91,0.22)] ' +
    'hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(225,91,91,0.3)] active:translate-y-0 active:scale-[0.99] ' +
    'disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_24px_rgba(225,91,91,0.22)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          'transition-[transform,box-shadow,background-color,color] duration-150 ease-[var(--ease-maidan)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          'disabled:cursor-not-allowed',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
