import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import type { User } from '@/lib/types';

// Renders the shared Forbidden state in place (no redirect) when a route
// guard fails, so the sidebar/topbar chrome stays visible and the reason is
// explained — per the design doc's calm-error tone. `allow` is a predicate
// rather than a fixed role list so callers can also gate on canUpload /
// canUseAiChat / is_active, not just role.
export function RequireRole({
  allow,
  reason,
  children,
}: {
  allow: (user: User) => boolean;
  reason?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !allow(user)) {
    return <ForbiddenPage reason={reason} />;
  }
  return <>{children}</>;
}
