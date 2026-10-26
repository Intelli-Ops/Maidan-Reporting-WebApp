import type { UserRole, UserStatus } from '@/lib/types';

export const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  operations_manager: 'Operations Manager',
  viewer: 'Viewer',
};

export const statusLabel: Record<UserStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
};
