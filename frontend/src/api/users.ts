import { apiRequest } from '@/api/client';
import type { User, UserRole } from '@/lib/types';

export function listPendingUsers() {
  return apiRequest<{ success: true; data: User[] }>('/auth/pending-users');
}

export function approveUser(id: number, input: { role: UserRole; canUpload: boolean; canUseAiChat: boolean }) {
  return apiRequest<{ success: true; message: string; data: { user: User } }>(`/auth/pending-users/${id}/approve`, {
    method: 'POST',
    body: input,
  });
}

export function rejectUser(id: number, reason?: string) {
  return apiRequest<{ success: true; message: string; data: { user: User } }>(`/auth/pending-users/${id}/reject`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
}

export function listAllUsers() {
  return apiRequest<{ success: true; data: User[] }>('/auth/users');
}

export function updateUser(
  id: number,
  input: { role?: UserRole; canUpload?: boolean; canUseAiChat?: boolean; isActive?: boolean }
) {
  return apiRequest<{ success: true; message: string; data: { user: User } }>(`/auth/users/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteUser(id: number) {
  return apiRequest<{ success: true; message: string }>(`/auth/users/${id}`, {
    method: 'DELETE',
  });
}
