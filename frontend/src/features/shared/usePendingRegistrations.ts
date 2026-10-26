import { useQuery } from '@tanstack/react-query';
import { listPendingUsers } from '@/api/users';

// Backs the Overview page's "needs attention" strip with the real approval
// queue rather than a fixture count.
//
// staleTime is deliberately 0: PendingRegistrationsPage approves/rejects
// through its own local useState rather than this cache, so a cached count
// here would keep claiming people are waiting after they've been actioned.
// Refetching on every Overview mount is one small request and keeps the
// badge honest.
//
// `enabled` gates the call on the caller's role — /auth/pending-users is
// admin/ops-only and 403s for everyone else.
export function usePendingRegistrations(enabled: boolean) {
  return useQuery({
    queryKey: ['pendingUsers'],
    queryFn: async () => (await listPendingUsers()).data,
    enabled,
    staleTime: 0,
    retry: false,
  });
}
