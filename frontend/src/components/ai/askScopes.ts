/**
 * Per-dashboard framing for the ask panel.
 *
 * The scope is a UI-side concept only. /api/ai/ask takes a bare question and
 * decides for itself which tables to touch, so questions go to the server
 * exactly as typed — nothing is prepended to steer it. What the scope changes
 * is the panel's title and its starter questions, which is what actually makes
 * the feature feel like it belongs to the dashboard it's sitting on: the
 * suggestions name that dashboard's tables and columns, so the first thing a
 * user clicks is already a question the AI can answer well.
 */
import type { AskScope } from '@/api/ai';

export type { AskScope };

interface ScopeConfig {
  title: string;
  /** Short name, for chips and history rows where the full title is too long. */
  label: string;
  /** Sits under the title — sets expectations about what it can reach. */
  blurb: string;
  suggestions: string[];
  /**
   * Carries the dashboards' own accent language across to the assistant, so a
   * conversation is recognisably "the expenses one" at a glance: blue for
   * booking volume, amber for spend, mint for money owed and returned.
   * The -deep text tokens exist because the fill-strength hues are unreadable
   * as label text on their own soft tints.
   */
  tone: { dot: string; chip: string; ring: string; glow: string };
}

export const ASK_SCOPES: Record<AskScope, ScopeConfig> = {
  bookings: {
    title: 'Ask about Bookings',
    label: 'Bookings',
    tone: {
      dot: 'bg-blue',
      chip: 'bg-blue-soft text-blue',
      ring: 'group-hover:border-blue/40',
      glow: 'rgb(24 95 165 / 0.14)',
    },
    blurb: 'Questions about revenue, discounts, sports and cancellations.',
    suggestions: [
      'Which facility had the highest net revenue last month?',
      'What is the average discount percentage by sport type?',
      'How many bookings were cancelled in the last 30 days?',
      'Which day of the week brings in the most revenue?',
    ],
  },
  expenses: {
    title: 'Ask about Expenses',
    label: 'Expenses',
    tone: {
      dot: 'bg-amber',
      chip: 'bg-amber-soft text-amber-deep',
      ring: 'group-hover:border-amber/50',
      glow: 'rgb(217 164 65 / 0.16)',
    },
    blurb: 'Questions about spend, categories, and payment methods.',
    suggestions: [
      'What were the top 5 expense categories last month?',
      'How much did we spend in cash versus other methods?',
      'Which facility has the highest expenses this year?',
      'What is the largest single expense recorded?',
    ],
  },
  investors: {
    title: 'Ask about Investors',
    label: 'Investors',
    tone: {
      dot: 'bg-mint',
      chip: 'bg-mint-soft text-mint-deep',
      ring: 'group-hover:border-mint/60',
      glow: 'rgb(93 202 165 / 0.18)',
    },
    blurb: 'Questions about profit, disbursements and outstanding liability.',
    suggestions: [
      'Which investor has the largest pending amount?',
      'What was the total profit per facility last quarter?',
      'How much has been disbursed in total this year?',
      'Which facility generated the most profit per rupee invested?',
    ],
  },
};
