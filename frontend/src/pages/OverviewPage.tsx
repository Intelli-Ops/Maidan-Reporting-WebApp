import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/auth/AuthContext';
import { ASK_SCOPES } from '@/components/ai/askScopes';
import { isAdminOrOpsManager } from '@/components/layout/navConfig';
import { HeroCard } from '@/components/overview/HeroCard';
import { EntryCard } from '@/components/overview/EntryCard';
import { ExceptionsStrip } from '@/components/overview/ExceptionsStrip';
import { usePendingRegistrations } from '@/features/shared/usePendingRegistrations';
import { overviewFixtures } from '@/lib/overviewFixtures';

// Entry point into the three reporting sections — deliberately not a fourth
// dashboard. It's sized to fit one screen without scrolling: the hero takes
// whatever height is left over after the fixed-height rows below it, so the
// page never grows past the viewport.
//
// The height math mirrors AppShell: 100vh, less the 64px Topbar, less the
// 32px top + 32px bottom padding on <main>'s inner wrapper. The min-height
// is the escape hatch — on a very short window the page scrolls rather than
// crushing the hero into an unreadable strip.
const FIT_TO_SCREEN = 'h-[calc(100vh-8rem)] min-h-[540px]';

export function OverviewPage() {
  const { user } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const canReviewRegistrations = !!user && isAdminOrOpsManager(user);
  const pendingQuery = usePendingRegistrations(canReviewRegistrations);

  if (!user) return null;

  // Undefined while loading or if the request failed — either way there's
  // nothing trustworthy to announce, so the strip stays hidden rather than
  // guessing. ExceptionsStrip itself no-ops on a count of 0.
  const pendingCount = pendingQuery.data?.length ?? 0;

  return (
    <div className={`flex flex-col gap-5 ${FIT_TO_SCREEN}`}>
      <HeroCard firstName={user.full_name.split(' ')[0]} />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 120, damping: 20 }}
        className="grid shrink-0 grid-cols-1 gap-5 sm:grid-cols-3"
      >
        {overviewFixtures.entries.map((entry) => (
          <EntryCard
            key={entry.title}
            eyebrow={entry.eyebrow}
            title={entry.title}
            value={entry.value}
            sub={entry.sub}
            href={entry.href}
            tone={ASK_SCOPES[entry.scope].tone}
            dimmed={hoveredCard !== null && hoveredCard !== entry.title}
            onHoverStart={() => setHoveredCard(entry.title)}
            onHoverEnd={() => setHoveredCard(null)}
          />
        ))}
      </motion.div>

      {pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className="shrink-0"
        >
          <ExceptionsStrip
            count={pendingCount}
            message={`${pendingCount === 1 ? 'registration' : 'registrations'} waiting for review`}
            href="/management/pending"
          />
        </motion.div>
      )}
    </div>
  );
}
