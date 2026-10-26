export type UserRole = 'admin' | 'operations_manager' | 'viewer';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole | null;
  status: UserStatus;
  can_upload: boolean;
  can_use_ai_chat: boolean;
  is_active: boolean;
  // Set only by scripts/set_system_admin.js on the server side; no API path
  // writes it, so it is read-only everywhere in the client.
  is_system_admin: boolean;
  created_at: string;
  approved_at?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}
