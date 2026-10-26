import type { ChatMessage } from '@/features/ai/useAiChat';
import { SparkleIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** Same night gradient as the hero KPI card, so the AI surfaces read as one family. */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #105484 0%, #168670 45%, #218E59 75%, #2C923F 100%)';

function AssistantMessage({ message }: { message: ChatMessage }) {
  if (message.pending) {
    return (
      <p className="flex items-center gap-2 px-1 text-[12px] text-ink-faint">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-transparent" />
        Working it out…
      </p>
    );
  }

  if (message.error) {
    return (
      <p className="rounded-[14px] border border-red/25 bg-red-soft/70 px-3 py-2 text-[12.5px] leading-snug text-ink">
        {message.error}
      </p>
    );
  }

  // Deliberately renders the plain-English answer and nothing else. The
  // generated SQL and the row count used to sit under it as disclosures, which
  // read to an operator as noise at best ("1 row") and as a leaked internal at
  // worst — this screen is used by people running the business, not by anyone
  // auditing the query. Both still travel in the API response and are kept in
  // the stored conversation, so the audit trail is intact server-side.
  return (
    <div className="card-surface p-3.5">
      <span
        className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white"
        style={{ background: BRAND_GRADIENT }}
        aria-hidden
      >
        <SparkleIcon className="h-3.5 w-3.5" />
      </span>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{message.content}</p>
    </div>
  );
}

export function AiThread({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {messages.map((message) =>
        message.role === 'user' ? (
          <p
            key={message.id}
            className="max-w-[88%] self-end rounded-[16px] rounded-br-[5px] px-3 py-2 text-[12.5px] leading-snug text-white shadow-[0_4px_12px_-4px_rgba(24,95,165,0.4)]"
            style={{ background: 'linear-gradient(135deg,#185FA5,#1F7A7A)' }}
          >
            {message.content}
          </p>
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}
    </div>
  );
}
