import type { User } from '@/lib/types';

// Dev-only fixture data for mock mode (npm run dev:mock) — lets every auth
// state and role/permission combination be clicked through instantly,
// without registering + admin-approving real users against the live
// backend. Mutations (register, reset/change password) persist to
// localStorage so they survive a page reload, not just client-side
// navigation — call window.__maidanMock.reset() in the devtools console to
// wipe back to the defaults below.
export interface MockUser extends User {
  password: string;
}

const DEFAULT_FIXTURE_USERS: MockUser[] = [
  {
    id: 1,
    email: 'admin@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Ada Admin',
    phone: '+92 300 1000001',
    role: 'admin',
    status: 'approved',
    can_upload: true,
    can_use_ai_chat: true,
    is_active: true,
    is_system_admin: true,
    created_at: '2026-01-05T09:00:00.000Z',
    approved_at: '2026-01-05T09:05:00.000Z',
  },
  {
    id: 2,
    email: 'ops@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Omar Operations',
    phone: '+92 300 1000002',
    role: 'operations_manager',
    status: 'approved',
    can_upload: true,
    can_use_ai_chat: false,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-01-10T09:00:00.000Z',
    approved_at: '2026-01-10T09:20:00.000Z',
  },
  {
    id: 3,
    email: 'viewer@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Vera Viewer',
    phone: '+92 300 1000003',
    role: 'viewer',
    status: 'approved',
    can_upload: false,
    can_use_ai_chat: false,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-01-15T09:00:00.000Z',
    approved_at: '2026-01-15T09:10:00.000Z',
  },
  {
    id: 4,
    email: 'viewer.ai@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Ivy Insights',
    phone: '+92 300 1000004',
    role: 'viewer',
    status: 'approved',
    can_upload: false,
    can_use_ai_chat: true,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-01-18T09:00:00.000Z',
    approved_at: '2026-01-18T09:10:00.000Z',
  },
  {
    id: 5,
    email: 'pending@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Peter Pending',
    phone: '+92 300 1000005',
    role: null,
    status: 'pending',
    can_upload: false,
    can_use_ai_chat: false,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-02-01T09:00:00.000Z',
    approved_at: null,
  },
  {
    id: 6,
    email: 'rejected@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Rita Rejected',
    phone: '+92 300 1000006',
    role: null,
    status: 'rejected',
    can_upload: false,
    can_use_ai_chat: false,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-02-02T09:00:00.000Z',
    approved_at: null,
  },
  {
    id: 7,
    email: 'deactivated@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Derek Deactivated',
    phone: '+92 300 1000007',
    role: 'viewer',
    status: 'approved',
    can_upload: false,
    can_use_ai_chat: false,
    is_active: false,
    is_system_admin: false,
    created_at: '2026-02-03T09:00:00.000Z',
    approved_at: '2026-02-03T09:10:00.000Z',
  },
  {
    // A second admin without the flag — sign in as this one to see the
    // controls that are reserved to id 1, and as id 1 to see them enabled.
    id: 8,
    email: 'admin2@maidan.pk',
    password: 'Mock@1234',
    full_name: 'Adam Admin',
    phone: '+92 300 1000008',
    role: 'admin',
    status: 'approved',
    can_upload: true,
    can_use_ai_chat: true,
    is_active: true,
    is_system_admin: false,
    created_at: '2026-02-04T09:00:00.000Z',
    approved_at: '2026-02-04T09:10:00.000Z',
  },
];

// Any login attempt against this address always comes back 429 — a quick
// way to click through the rate-limit countdown UI without waiting out a
// real 15-minute window.
export const RATE_LIMITED_EMAIL = 'ratelimited@maidan.pk';

const STORAGE_KEY = 'maidan.mock.state';

interface PersistedState {
  users: MockUser[];
  otps: Record<string, OtpEntry>;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

const persisted = loadPersistedState();

export const fixtureUsers: MockUser[] = persisted?.users ?? structuredClone(DEFAULT_FIXTURE_USERS);

interface OtpEntry {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>(Object.entries(persisted?.otps ?? {}));

function persist(): void {
  const state: PersistedState = { users: fixtureUsers, otps: Object.fromEntries(otpStore) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function findFixtureByEmail(email: string): MockUser | undefined {
  return fixtureUsers.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
}

export function findFixtureById(id: number): MockUser | undefined {
  return fixtureUsers.find((u) => u.id === id);
}

export function addFixtureUser(user: MockUser): void {
  fixtureUsers.push(user);
  persist();
}

export function removeFixtureUser(id: number): boolean {
  const index = fixtureUsers.findIndex((u) => u.id === id);
  if (index === -1) return false;
  fixtureUsers.splice(index, 1);
  persist();
  return true;
}

export function toPublicUser(u: MockUser): User {
  const { password: _password, ...publicUser } = u;
  return publicUser;
}

// Not a real JWT — just enough structure for the mock /me handler to look
// the caller back up. Never used outside dev mock mode.
export function encodeMockToken(userId: number): string {
  return `mock.${btoa(JSON.stringify({ id: userId }))}`;
}

export function decodeMockToken(token: string): number | null {
  if (!token.startsWith('mock.')) return null;
  try {
    const payload = JSON.parse(atob(token.slice('mock.'.length)));
    return typeof payload.id === 'number' ? payload.id : null;
  } catch {
    return null;
  }
}

export function issueOtp(email: string): string {
  const code = '123456';
  otpStore.set(email.toLowerCase().trim(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  persist();
  return code;
}

export function verifyOtp(email: string, code: string): boolean {
  const entry = otpStore.get(email.toLowerCase().trim());
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) return false;
  return entry.code === code;
}

export function consumeOtp(email: string): void {
  otpStore.delete(email.toLowerCase().trim());
  persist();
}

// setPassword/setUserField route through here so every mutation persists —
// don't assign fixture.password or other fields directly from a handler.
export function persistFixtureChanges(): void {
  persist();
}

declare global {
  interface Window {
    __maidanMock?: { reset: () => void; users: MockUser[] };
  }
}

if (typeof window !== 'undefined') {
  window.__maidanMock = {
    users: fixtureUsers,
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
  };
}
