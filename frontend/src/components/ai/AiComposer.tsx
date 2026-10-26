import { forwardRef } from 'react';
import { MAX_QUESTION_LENGTH } from '@/api/ai';
import { SendIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export const AiComposer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    placeholder: string;
    disabled?: boolean;
    pending?: boolean;
    /** Shown above the field — the 503 or rate-limit explanation. */
    notice?: string | null;
    rows?: number;
  }
>(function AiComposer({ value, onChange, onSubmit, placeholder, disabled, pending, notice, rows = 2 }, ref) {
  const canSend = Boolean(value.trim()) && !disabled && !pending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {notice && <p className="mb-2 text-[11.5px] leading-snug text-ink-muted">{notice}</p>}

      {/* One input surface holding the field and its send button, rather than a
          bordered box with controls stacked underneath it. */}
      <div
        className={cn(
          'rounded-[16px] border border-border bg-surface p-1.5 transition-all duration-150',
          'focus-within:border-blue-bright focus-within:ring-2 focus-within:ring-blue-bright/25',
          disabled && 'opacity-60'
        )}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention for a
            // chat composer. Without this the field would need a click on send
            // for every question.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-snug text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span className="truncate text-[10.5px] text-ink-faint">
            {value.length > MAX_QUESTION_LENGTH - 100 ? (
              <span className={cn('tabular-nums', value.length >= MAX_QUESTION_LENGTH && 'text-red')}>
                {value.length}/{MAX_QUESTION_LENGTH}
              </span>
            ) : (
              <>
                <kbd className="font-sans font-semibold">Enter</kbd> to send
              </>
            )}
          </span>
          {/*
            A bespoke button rather than <Button size="icon">: this one needs to
            be circular, and `cn` is plain clsx with no class-merge, so a
            rounded-full override would fight the component's own rounded-md on
            stylesheet order rather than on class order.
          */}
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Ask"
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright focus-visible:ring-offset-2',
              canSend ? 'shadow-[0_4px_12px_-2px_rgba(24,95,165,0.45)] hover:-translate-y-px' : 'cursor-not-allowed opacity-40'
            )}
            style={{ background: 'linear-gradient(135deg,#185FA5,#3B6D11)' }}
          >
            {pending ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
});
