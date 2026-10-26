import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ASK_SCOPES, type AskScope } from '@/components/ai/askScopes';
import { AiComposer } from '@/components/ai/AiComposer';
import { AiThread, BRAND_GRADIENT } from '@/components/ai/AiThread';
import { useAiChat } from '@/features/ai/useAiChat';
import { ArrowRightIcon, SparkleIcon, XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

// Cycles the accent tokens across the starter questions — color rhythm without
// inventing four icons that would each have to mean something.
const DOT_TONES = ['bg-blue', 'bg-mint', 'bg-amber', 'bg-green'];

/**
 * The dashboard-local ask surface: a small anchored card, not a full-height
 * sheet. The previous version spanned the viewport and covered the dashboard
 * the question was about, which defeated the point of asking in place — so
 * this is capped in both directions and sized to its content, growing only
 * until it hits the cap and then scrolling internally.
 *
 * Anything longer than a quick exchange belongs on /assistant, which is one
 * click away in the header and carries the conversation across.
 */
export function AskPopover({ scope, open, onClose }: { scope: AskScope; open: boolean; onClose: () => void }) {
  const config = ASK_SCOPES[scope];
  const [question, setQuestion] = useState('');
  const chat = useAiChat({ scope });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages]);

  function send(text: string) {
    chat.submit(text);
    setQuestion('');
  }

  const notice = chat.unavailable ?? (chat.cooldown > 0 ? `Too many questions. Try again in ${chat.cooldown}s.` : null);

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-hidden={!open}
      // Not modal and no backdrop: the whole point is asking about the
      // dashboard behind it, which has to stay readable and interactive.
      className={cn(
        'fixed bottom-6 right-6 z-40 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[20px]',
        // Content-sized, capped: a two-line answer gets a small card, a long
        // one stops at 60vh and scrolls rather than filling the screen.
        'max-h-[min(60vh,520px)]',
        'border border-white/60 bg-canvas/95 shadow-[0_24px_60px_-12px_rgb(16_24_40/0.3)] backdrop-blur-xl',
        'transition-all duration-200 ease-[var(--ease-maidan)]',
        open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0'
      )}
    >
      <header className="flex items-center gap-2 px-4 py-3" style={{ background: BRAND_GRADIENT }}>
        <SparkleIcon className="h-4 w-4 shrink-0 text-white" />
        <h2 id={titleId} className="min-w-0 flex-1 truncate font-heading text-[14px] font-semibold text-white">
          {config.title}
        </h2>
        <Link
          to={chat.activeId ? `/assistant?c=${chat.activeId}` : '/assistant'}
          className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/15 hover:text-white"
        >
          Full screen
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {chat.messages.length === 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Try asking</p>
            {config.suggestions.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={chat.blocked}
                className={cn(
                  'group flex items-center gap-2 rounded-[12px] border border-white/70 bg-surface/70 px-2.5 py-2 text-left',
                  'transition-all duration-200 ease-[var(--ease-maidan)]',
                  'hover:border-blue/30 hover:bg-surface hover:shadow-[0_6px_16px_-8px_rgb(16_24_40/0.2)]',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[i % DOT_TONES.length])} aria-hidden />
                <span className="flex-1 text-[12px] leading-snug text-ink-muted transition-colors group-hover:text-ink">
                  {s}
                </span>
                <ArrowRightIcon className="h-3 w-3 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        ) : (
          <AiThread messages={chat.messages} />
        )}
      </div>

      <div className="border-t border-border bg-surface/80 px-3 py-2.5 backdrop-blur-sm">
        <AiComposer
          ref={inputRef}
          value={question}
          onChange={setQuestion}
          onSubmit={() => send(question)}
          placeholder={`Ask about ${scope}…`}
          disabled={chat.blocked}
          pending={chat.pending}
          notice={notice}
          rows={1}
        />
      </div>
    </div>
  );
}
