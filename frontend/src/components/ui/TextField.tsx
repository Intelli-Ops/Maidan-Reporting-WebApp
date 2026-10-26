import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, icon, id, className, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-[12.5px] font-medium text-label">
          {label}
        </label>
        <div
          className={cn(
            'flex h-[46px] items-center gap-2.5 rounded-md border bg-surface px-3.5',
            'transition-colors duration-200 ease-[var(--ease-maidan)]',
            'focus-within:border-blue-bright focus-within:shadow-[0_0_0_3px_rgba(55,138,221,0.15)]',
            error ? 'border-red' : 'border-border'
          )}
        >
          {icon && <span className="shrink-0 text-ink-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'h-full flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint',
              'outline-none disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
TextField.displayName = 'TextField';
