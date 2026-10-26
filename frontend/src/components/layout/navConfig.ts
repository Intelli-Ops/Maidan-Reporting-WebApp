import type { User } from '@/lib/types';

export interface NavItem {
  label: string;
  to: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const isAdmin = (user: User) => user.role === 'admin';
const isAdminOrOpsManager = (user: User) => user.role === 'admin' || user.role === 'operations_manager';
const canUseAi = (user: User) => user.can_use_ai_chat || user.role === 'admin';
const canUpload = (user: User) => user.can_upload || user.role === 'admin';

// v1 is reporting-only per the architecture plan — no live Operations
// (courts/locations/bookings CRUD) section, since the backend has no
// endpoints for it yet.
export function buildNavSections(user: User): NavSection[] {
  const sections: NavSection[] = [
    { label: 'Overview', items: [{ label: 'Home', to: '/' }] },
    {
      label: 'Reporting',
      items: [
        { label: 'Bookings', to: '/reporting/bookings' },
        { label: 'Investor Reports', to: '/reporting/investors' },
        { label: 'Expenses', to: '/reporting/expenses' },
      ],
    },
  ];

  // Two ways in, one history: the AskDock popover on each dashboard for a
  // quick question in context, and this screen for longer sessions and for
  // everything asked previously. Both persist through /api/ai/conversations.
  if (canUseAi(user)) {
    sections.push({ label: 'AI Assistant', items: [{ label: 'Ask AI', to: '/assistant' }] });
  }

  if (isAdminOrOpsManager(user)) {
    const managementItems: NavItem[] = [
      { label: 'Pending Registrations', to: '/management/pending' },
      { label: 'All Users', to: '/management/users' },
    ];
    if (canUpload(user)) {
      managementItems.push({ label: 'Data Import', to: '/management/import' });
    }
    sections.push({ label: 'Management', items: managementItems });
  }

  sections.push({ label: 'Settings', items: [{ label: 'Profile & Settings', to: '/settings' }] });

  return sections;
}

export { isAdmin, isAdminOrOpsManager, canUseAi, canUpload };
