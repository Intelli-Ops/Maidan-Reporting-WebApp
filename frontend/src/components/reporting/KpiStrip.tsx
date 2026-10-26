import type { ReactNode } from 'react';
import { Metric, type ProgressTone } from '@/components/reporting/Metric';
import { cn } from '@/lib/utils';

export interface KpiItem {
  label: string;
  value: ReactNode;
  changePct?: number;
  unit?: string;
  invert?: boolean;
  caption?: string;
  /** 'hero' picks out the one headline metric with the brand night gradient — use on at most one item. */
  tone?: 'default' | 'hero';
  /** Tints the card and its top rule — for cards that carry a warning or a standing obligation. */
  accent?: ProgressTone;
  /** Share bar under the value, for metrics that are a portion of a whole. */
  progress?: { pct: number; tone?: ProgressTone };
  /** Smaller value type — for cards whose value is a name rather than a figure. */
  size?: 'md' | 'sm';
  /**
   * Marks whether the card responds to the dashboard's date filter. Only worth
   * setting on a strip that mixes the two — where every card moves together,
   * the badge is noise. See the Investors overview, which puts period activity
   * (disbursed, profit) next to running balances (investment, liability) that
   * hold no matter what range is picked.
   */
  scope?: 'period' | 'snapshot';
}

const SCOPE_LABELS: Record<NonNullable<KpiItem['scope']>, string> = {
  period: 'This period',
  snapshot: 'All-time',
};

/**
 * Sits along the bottom edge of the card rather than beside the label: at
 * five-across a card is ~175px of content width, which a label like
 * "Highest Pending Investor" very nearly fills on its own. Sharing the trend
 * pill's row instead was tried and dropped — it saved 31px of card height but
 * forced the captions down to a handful of words to fit.
 */
function ScopeBadge({ scope, onDark }: { scope: NonNullable<KpiItem['scope']>; onDark?: boolean }) {
  return (
    <span
      className={cn(
        'mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        onDark ? 'bg-white/15 text-white/70' : 'bg-ink/[0.05] text-ink-faint'
      )}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

// Accent cards get a colored hairline along the top edge plus a wash of the
// same hue, rather than a full colored fill: at five-across the strip has to
// stay scannable, and a saturated card would out-shout the hero KPI.
const ACCENT_STYLES: Record<ProgressTone, { card: string; rule: string }> = {
  blue: { card: 'bg-blue-soft/50', rule: 'bg-blue' },
  mint: { card: 'bg-mint-soft/60', rule: 'bg-mint' },
  amber: { card: 'bg-amber-soft/60', rule: 'bg-amber' },
  red: { card: 'bg-red-soft/60', rule: 'bg-red' },
};

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ tone, accent, scope, ...item }) => {
        if (tone === 'hero') {
          return (
            <div
              key={item.label}
              className="flex flex-col rounded-[20px] border border-white/10 p-5"
              // Same login-page gradient (NightScene.tsx), just lightened ~22
              // points of HSL lightness per stop, same hue/saturation — a
              // middle ground between the near-black original and a pastel
              // wash.
              style={{ background: 'linear-gradient(135deg, #105484 0%, #168670 45%, #218E59 75%, #2C923F 100%)' }}
            >
              <Metric {...item} tone="onDark" />
              {scope && (
                <div className="mt-auto">
                  <ScopeBadge scope={scope} onDark />
                </div>
              )}
            </div>
          );
        }

        const accentStyle = accent ? ACCENT_STYLES[accent] : null;

        return (
          <div
            key={item.label}
            className={cn('card-surface relative flex flex-col overflow-hidden p-5', accentStyle?.card)}
          >
            {accentStyle && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', accentStyle.rule)} />}
            <Metric {...item} />
            {/* mt-auto pins the badge to the bottom edge so it lines up across
                the row even though the cards above it are different heights
                (some carry a progress bar, some a trend tag, some neither). */}
            {scope && (
              <div className="mt-auto">
                <ScopeBadge scope={scope} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
