import { useState } from 'react';
import { AskPopover } from '@/components/ai/AskPopover';
import type { AskScope } from '@/components/ai/askScopes';
import { useAuth } from '@/auth/AuthContext';
import { canUseAi } from '@/components/layout/navConfig';
import { SparkleIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * The dashboard-local replacement for a standalone assistant screen: a docked
 * trigger that opens an ask panel scoped to the dashboard it's mounted on.
 *
 * Gated on the same can_use_ai_chat flag the endpoint enforces (admins always
 * pass), so users without access never see a control that would 403 on click.
 */
export function AskDock({ scope }: { scope: AskScope }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || !canUseAi(user)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask about this dashboard"
        aria-expanded={open}
        className={cn(
          'fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full py-3 pl-4 pr-5',
          'bg-[linear-gradient(135deg,#185FA5,#3B6D11)] text-[13px] font-semibold text-white',
          'shadow-[0_10px_28px_rgba(24,95,165,0.32)] transition-all duration-200 ease-[var(--ease-maidan)]',
          'hover:-translate-y-px hover:shadow-[0_14px_34px_rgba(24,95,165,0.4)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-bright focus-visible:ring-offset-2',
          // Hidden rather than unmounted while the panel is open: it sits
          // directly under the panel's left edge, so leaving it visible reads
          // as a stray button floating on top of the thing it opened.
          open && 'pointer-events-none translate-y-2 opacity-0'
        )}
      >
        <SparkleIcon className="h-4 w-4" />
        Ask
      </button>

      <AskPopover scope={scope} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
