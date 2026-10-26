import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { AiComposer } from '@/components/ai/AiComposer';
import { AiThread, BRAND_GRADIENT } from '@/components/ai/AiThread';
import { ASK_SCOPES, type AskScope } from '@/components/ai/askScopes';
import { useAiChat, useConversations, useDeleteConversation } from '@/features/ai/useAiChat';
import type { AiConversationSummary } from '@/api/ai';
import { ArrowRightIcon, SparkleIcon, TrashIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * Aurora wash behind the thread. Same three-radial recipe as .frosted-canvas,
 * pushed a little warmer — a flat panel is what made this screen read as an
 * empty document rather than a place to start something.
 */
const AURORA =
  'radial-gradient(circle at 12% -5%, rgb(24 95 165 / 0.10), transparent 45%),' +
  'radial-gradient(circle at 88% 5%, rgb(93 202 165 / 0.12), transparent 42%),' +
  'radial-gradient(circle at 60% 105%, rgb(217 164 65 / 0.08), transparent 45%)';

const SCOPE_KEYS = Object.keys(ASK_SCOPES) as AskScope[];

const toneFor = (scope: string | null) => (scope && scope in ASK_SCOPES ? ASK_SCOPES[scope as AskScope].tone : null);
const labelFor = (scope: string | null) => (scope && scope in ASK_SCOPES ? ASK_SCOPES[scope as AskScope].label : null);

/** Relative day labels beat timestamps in a sidebar you scan rather than read. */
function relativeDay(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Buckets history by recency. A flat list of near-identical rows is the part
 * that felt cheapest — headers give the column rhythm and let you find "the
 * one from yesterday" without reading every title.
 */
function groupByRecency(conversations: AiConversationSummary[]) {
  const groups: { label: string; items: AiConversationSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];
  for (const c of conversations) {
    const days = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 86_400_000);
    groups[days <= 0 ? 0 : days === 1 ? 1 : 2].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function AssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The popover's "Full screen" link carries ?c=<id>, so an exchange started
  // on a dashboard continues here rather than restarting.
  const selectedId = searchParams.get('c');

  const [question, setQuestion] = useState('');
  const conversations = useConversations();
  const removeConversation = useDeleteConversation();
  const chat = useAiChat({ conversationId: selectedId });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const grouped = useMemo(() => groupByRecency(conversations.data ?? []), [conversations.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages]);

  // A conversation created from the blank state has to become the selected
  // one, or the next question would start yet another thread.
  //
  // The `!selectedId` guard is load-bearing. This used to fire whenever
  // activeId and selectedId merely disagreed, which made picking a chat from
  // the sidebar unusable: selecting B set the URL to B, this effect still saw
  // the previous render's activeId (A) and wrote the URL straight back to A,
  // the hook then adopted A and the two swapped roles every render — an
  // endless A/B/A/B loop that showed up as the screen flickering and snapping
  // back to the last conversation. The URL is the user's choice; this effect
  // only ever fills it in when it is empty.
  useEffect(() => {
    if (chat.activeId && !selectedId) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('c', chat.activeId as string);
          return params;
        },
        { replace: true }
      );
    }
  }, [chat.activeId, selectedId, setSearchParams]);

  function select(id: string | null) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (id) params.set('c', id);
        else params.delete('c');
        return params;
      },
      { replace: true }
    );
  }

  function send(text: string) {
    chat.submit(text);
    setQuestion('');
  }

  async function handleDelete(id: string) {
    await removeConversation.mutateAsync(id);
    if (id === selectedId) {
      chat.reset();
      select(null);
    }
  }

  const notice = chat.unavailable ?? (chat.cooldown > 0 ? `Too many questions. Try again in ${chat.cooldown}s.` : null);
  const isEmpty = !chat.isLoadingThread && chat.messages.length === 0;

  return (
    // AppShell's outlet wrapper is height-auto, so `h-full` here would collapse
    // to the content and leave the composer floating mid-page. The viewport
    // calc subtracts the topbar, the shell's vertical padding and PageHeader.
    <div className="flex min-h-[calc(100vh-240px)] flex-col">
      <PageHeader
        eyebrow="Assistant"
        title="Ask AI"
        description="Ask questions about bookings, expenses and investors in plain English."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[264px_1fr]">
        {/* ---------------------------------------------------------------- */}
        {/* History                                                          */}
        {/* ---------------------------------------------------------------- */}
        <aside className="card-surface flex max-h-[70vh] min-h-0 flex-col overflow-hidden lg:max-h-none">
          <div className="border-b border-border/70 px-3 py-3">
            <button
              type="button"
              onClick={() => {
                chat.reset();
                select(null);
                inputRef.current?.focus();
              }}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-[12px] py-2 text-[12.5px] font-semibold text-white',
                'shadow-[0_6px_16px_-6px_rgba(24,95,165,0.5)] transition-all duration-200 ease-[var(--ease-maidan)]',
                'hover:-translate-y-px hover:shadow-[0_10px_22px_-8px_rgba(24,95,165,0.6)]'
              )}
              style={{ background: BRAND_GRADIENT }}
            >
              <SparkleIcon className="h-3.5 w-3.5" />
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {conversations.isLoading && <p className="px-2 py-3 text-[12px] text-ink-faint">Loading…</p>}
            {!conversations.isLoading && grouped.length === 0 && (
              <p className="px-2 py-3 text-[12px] leading-snug text-ink-faint">
                No saved chats yet. Anything you ask here (or from a dashboard) is kept to your account.
              </p>
            )}

            {grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((c) => {
                    const tone = toneFor(c.scope);
                    const active = c.id === selectedId;
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          'group relative flex items-start gap-1 overflow-hidden rounded-[12px] pl-3 pr-1 py-2 transition-all duration-200',
                          active ? 'bg-surface shadow-[0_2px_8px_-2px_rgb(16_24_40/0.1)]' : 'hover:bg-surface/70'
                        )}
                      >
                        {/* Accent rail in the conversation's own scope color —
                            the same cue the KPI cards use for their top rule. */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-y-1 left-0 w-[3px] rounded-full transition-opacity duration-200',
                            tone?.dot ?? 'bg-ink/20',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                          )}
                        />
                        <button type="button" onClick={() => select(c.id)} className="min-w-0 flex-1 text-left">
                          <span
                            className={cn(
                              'line-clamp-2 text-[12.5px] leading-snug transition-colors',
                              active ? 'font-semibold text-ink' : 'text-ink-muted group-hover:text-ink'
                            )}
                          >
                            {c.title}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5">
                            {labelFor(c.scope) && (
                              <span
                                className={cn(
                                  'rounded-full px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide',
                                  tone?.chip
                                )}
                              >
                                {labelFor(c.scope)}
                              </span>
                            )}
                            <span className="text-[10.5px] text-ink-faint">{relativeDay(c.updatedAt)}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          aria-label={`Delete conversation: ${c.title}`}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 transition-all hover:bg-red-soft hover:text-red focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Thread                                                           */}
        {/* ---------------------------------------------------------------- */}
        <section className="card-surface relative flex min-h-0 flex-col overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: AURORA }} />

          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-5 py-6">
            {chat.isLoadingThread && <p className="text-[12px] text-ink-faint">Loading conversation…</p>}

            {isEmpty ? (
              <div className="mx-auto flex h-full max-w-[560px] flex-col items-center justify-center text-center">
                <div className="relative">
                  {/* Soft bloom behind the mark — the depth cue that separates
                      a considered empty state from a placeholder. */}
                  <span
                    aria-hidden
                    className="absolute -inset-4 rounded-full opacity-45 blur-2xl"
                    style={{ background: BRAND_GRADIENT }}
                  />
                  <span
                    className="relative grid h-14 w-14 place-items-center rounded-[18px] text-white shadow-[0_10px_28px_-8px_rgba(16,84,132,0.7)]"
                    style={{ background: BRAND_GRADIENT }}
                    aria-hidden
                  >
                    <SparkleIcon className="h-7 w-7" />
                  </span>
                </div>

                <h2 className="mt-5 font-heading text-[26px] font-semibold leading-tight tracking-tight text-ink">
                  What do you want to know?
                </h2>
                <p className="mt-1.5 max-w-[380px] text-[13px] leading-relaxed text-ink-muted">
                  Answers come from live booking, expense and investor records.
                </p>

                <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-3">
                  {/* One starter per dashboard, each in that dashboard's color,
                      so the blank screen shows the breadth of what's reachable
                      rather than one area of it. */}
                  {SCOPE_KEYS.map((key) => {
                    const scope = ASK_SCOPES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => send(scope.suggestions[0])}
                        disabled={chat.blocked}
                        className={cn(
                          'group relative flex flex-col overflow-hidden rounded-[16px] border border-white/70 bg-surface/80 p-3.5 text-left',
                          'shadow-[0_1px_2px_rgb(16_24_40/0.04)] backdrop-blur-sm',
                          'transition-all duration-200 ease-[var(--ease-maidan)]',
                          'hover:-translate-y-0.5 hover:bg-surface hover:shadow-[0_14px_30px_-12px_rgb(16_24_40/0.28)]',
                          scope.tone.ring,
                          'disabled:pointer-events-none disabled:opacity-50'
                        )}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                          style={{ background: scope.tone.glow }}
                        />
                        <span className="flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', scope.tone.dot)} aria-hidden />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                            {scope.label}
                          </span>
                        </span>
                        <span className="mt-2 flex-1 text-[12.5px] leading-snug text-ink-muted transition-colors group-hover:text-ink">
                          {scope.suggestions[0]}
                        </span>
                        <ArrowRightIcon className="mt-2.5 h-3.5 w-3.5 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <AiThread messages={chat.messages} className="mx-auto max-w-[720px]" />
            )}
          </div>

          <div className="relative border-t border-border/70 bg-surface/70 px-5 py-4 backdrop-blur-sm">
            <div className="mx-auto max-w-[720px]">
              <AiComposer
                ref={inputRef}
                value={question}
                onChange={setQuestion}
                onSubmit={() => send(question)}
                placeholder="Ask anything about your data…"
                disabled={chat.blocked}
                pending={chat.pending}
                notice={notice}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
