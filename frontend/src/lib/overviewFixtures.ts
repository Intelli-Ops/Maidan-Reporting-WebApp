// Illustrative "this month" numbers for the Overview page's hero. There's no
// dedicated backend endpoint for this yet — per the architecture plan,
// Overview aggregates client-side from the three dashboard endpoints
// (bookings/investors/expenses), which aren't wired up in the frontend yet
// either. Once those exist, this module goes away in favor of a real hook
// that derives the same shape from live queries.
//
// Note: there's no "utilization %" anywhere in the real bookings API (no
// court-count/operating-hours capacity data exists server-side), so the hero
// chip intentionally uses Cancellation Rate instead — a real KPI the API
// returns.

import type { AskScope } from '@/components/ai/askScopes';

export interface EntryFixture {
  title: string;
  eyebrow: string;
  value: string;
  sub: string;
  href: string;
  /** Keys into ASK_SCOPES for this dashboard's accent colour. */
  scope: AskScope;
}

export const overviewFixtures = {
  period: 'This month',

  hero: {
    label: 'Total Revenue',
    value: 'PKR 4.82M',
    changePct: 12.4,
    spark: [3.2, 3.6, 3.4, 3.9, 4.1, 4.0, 4.4, 4.6, 4.5, 4.82],
    chips: [
      { label: 'Cancellation Rate', value: '4.1%' },
      { label: 'Bookings', value: '1,284' },
    ],
  },

  // `scope` keys into ASK_SCOPES for the accent colour, so each card glows in
  // the same hue as the Ask AI starter for the same dashboard.
  entries: [
    {
      title: 'Bookings',
      eyebrow: 'Reporting',
      value: '1,284 bookings',
      sub: 'PKR 4.82M revenue this month',
      href: '/reporting/bookings',
      scope: 'bookings',
    },
    {
      title: 'Investor Reports',
      eyebrow: 'Reporting',
      value: 'PKR 1.36M net profit',
      sub: '3 disbursements pending',
      href: '/reporting/investors',
      scope: 'investors',
    },
    {
      title: 'Expenses',
      eyebrow: 'Reporting',
      value: 'PKR 890K',
      sub: '↓ 3.2% vs last month',
      href: '/reporting/expenses',
      scope: 'expenses',
    },
  ] satisfies EntryFixture[],
};
