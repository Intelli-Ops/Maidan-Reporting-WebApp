import { apiRequest } from '@/api/client';
import type { User } from '@/lib/types';

export function login(email: string, password: string) {
  return apiRequest<{ success: true; message: string; data: { token: string; user: User } }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export function register(input: { fullName: string; email: string; phone: string; password: string }) {
  return apiRequest<{ success: true; message: string; data: { user: User } }>('/auth/register', {
    method: 'POST',
    body: input,
    skipAuth: true,
  });
}

export function forgotPassword(email: string) {
  return apiRequest<{ success: true; message: string; data?: { devOtp: string } }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  });
}

export function resetPassword(input: { email: string; otp: string; newPassword: string }) {
  return apiRequest<{ success: true; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: input,
    skipAuth: true,
  });
}

export function getMe() {
  return apiRequest<{ success: true; data: { user: User } }>('/auth/me');
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiRequest<{ success: true; message: string }>('/auth/change-password', {
    method: 'POST',
    body: input,
  });
}
