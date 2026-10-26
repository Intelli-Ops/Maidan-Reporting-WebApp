import { http, HttpResponse } from 'msw';
import {
  RATE_LIMITED_EMAIL,
  addFixtureUser,
  consumeOtp,
  decodeMockToken,
  encodeMockToken,
  findFixtureByEmail,
  findFixtureById,
  fixtureUsers,
  issueOtp,
  persistFixtureChanges,
  removeFixtureUser,
  toPublicUser,
  verifyOtp,
  type MockUser,
} from '@/mocks/fixtures';
import { MOCK_FACILITIES, MOCK_PAYMENT_METHODS, MOCK_SPORTS, buildBookingsDashboardMock } from '@/mocks/bookingsFixtures';
import { MOCK_INVESTORS, buildInvestorsDashboardMock } from '@/mocks/investorsFixtures';
import { MOCK_CATEGORIES, buildExpensesDashboardMock, getAccountReferenceMock } from '@/mocks/expensesFixtures';
import type { Granularity } from '@/lib/types/bookingsDashboard';
import type { InvestorStatus } from '@/lib/types/investorsDashboard';
import type { ExpenseGranularity } from '@/lib/types/expensesDashboard';

// Mirrors middleware/validators/auth.validators.js closely enough that the
// mock produces the same field-error shape ({ field, message }) the real
// backend does, so form error-handling can be exercised without it.
function passwordStrengthErrors(field: string, password: string) {
  const errors: { field: string; message: string }[] = [];
  if (password.length < 8) errors.push({ field, message: 'Password must be at least 8 characters.' });
  if (!/[a-z]/.test(password)) errors.push({ field, message: 'Password must contain a lowercase letter.' });
  if (!/[A-Z]/.test(password)) errors.push({ field, message: 'Password must contain an uppercase letter.' });
  if (!/[0-9]/.test(password)) errors.push({ field, message: 'Password must contain a number.' });
  return errors;
}

function fieldErrorResponse(errors: { field: string; message: string }[]) {
  return HttpResponse.json({ success: false, error: errors[0].message, errors }, { status: 400 });
}

// ---------------------------------------------------------------------------
// In-memory stand-in for the ai_conversations / ai_messages tables. Lives for
// the page session only, which is enough to exercise the sidebar, thread
// loading and delete. Keyed by user id so the per-user isolation the real
// service enforces is reproduced rather than assumed.
// ---------------------------------------------------------------------------
interface MockConversation {
  id: string;
  userId: number;
  title: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    rowCount?: number;
    rows?: Record<string, unknown>[];
    error?: string;
    createdAt: string;
  }[];
}

// Persisted for the same reason fixtures.ts persists users: handler state
// lives in the page's JS context, so without this a reload wipes the history
// and the feature under test — saved chats — can only ever be exercised across
// client-side navigation. Own key so window.__maidanMock.reset() and this stay
// independent.
const AI_STORAGE_KEY = 'maidan.mock.ai';

function loadMockConversations(): MockConversation[] {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockConversation[]) : [];
  } catch {
    return [];
  }
}

const mockConversations: MockConversation[] = loadMockConversations();
let mockConversationSeq = Math.max(0, ...mockConversations.map((c) => Number(c.id))) + 1;
let mockMessageSeq = Math.max(0, ...mockConversations.flatMap((c) => c.messages.map((m) => Number(m.id)))) + 1;

function persistMockConversations() {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(mockConversations));
  } catch {
    // Quota or private-mode failure — in-memory state still works for the session.
  }
}

function deriveMockTitle(question: string) {
  const clean = question.trim().replace(/\s+/g, ' ');
  return clean.length <= 60 ? clean : `${clean.slice(0, 60).trimEnd()}…`;
}

function listMockConversations(userId: number) {
  return mockConversations
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ messages, userId: _userId, ...rest }) => ({ ...rest, messageCount: messages.length }));
}

function getMockConversation(userId: number, id: string) {
  const found = mockConversations.find((c) => c.id === id && c.userId === userId);
  if (!found) return null;
  const { userId: _userId, ...rest } = found;
  return rest;
}

function deleteMockConversation(userId: number, id: string) {
  const i = mockConversations.findIndex((c) => c.id === id && c.userId === userId);
  if (i === -1) return false;
  mockConversations.splice(i, 1);
  persistMockConversations();
  return true;
}

function appendMockExchange(
  userId: number,
  conversationId: string | number | null,
  scope: string | undefined,
  question: string,
  answer: { answer: string; sql: string; rowCount: number; rows: Record<string, unknown>[] } | null,
  errorMessage?: string
) {
  const now = new Date().toISOString();
  let conversation = conversationId
    ? mockConversations.find((c) => c.id === String(conversationId) && c.userId === userId)
    : undefined;

  if (!conversation) {
    conversation = {
      id: String(mockConversationSeq++),
      userId,
      title: deriveMockTitle(question),
      scope: scope ?? null,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    mockConversations.push(conversation);
  }

  conversation.messages.push({ id: String(mockMessageSeq++), role: 'user', content: question, createdAt: now });
  conversation.messages.push(
    errorMessage
      ? { id: String(mockMessageSeq++), role: 'assistant', content: '', error: errorMessage, createdAt: now }
      : {
          id: String(mockMessageSeq++),
          role: 'assistant',
          content: answer!.answer,
          sql: answer!.sql,
          rowCount: answer!.rowCount,
          rows: answer!.rows,
          createdAt: now,
        }
  );
  conversation.updatedAt = new Date().toISOString();
  persistMockConversations();
  return conversation.id;
}

function findAuthedUser(request: Request): MockUser | null {
  const auth = request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  const id = token ? decodeMockToken(token) : null;
  return id !== null ? (findFixtureById(id) ?? null) : null;
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };

    if (email?.toLowerCase().trim() === RATE_LIMITED_EMAIL) {
      return HttpResponse.json(
        { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
        { status: 429, headers: { 'RateLimit-Reset': '15' } }
      );
    }

    const invalidCredentials = () =>
      HttpResponse.json(
        { success: false, errorCode: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' },
        { status: 401 }
      );

    const user = findFixtureByEmail(email ?? '');
    if (!user || user.password !== password) return invalidCredentials();

    if (user.status === 'pending') {
      return HttpResponse.json(
        { success: false, errorCode: 'PENDING_APPROVAL', error: 'Your account is pending admin approval.' },
        { status: 403 }
      );
    }
    if (user.status === 'rejected') {
      return HttpResponse.json(
        {
          success: false,
          errorCode: 'ACCOUNT_REJECTED',
          error: 'Your registration was not approved. Please contact an administrator.',
        },
        { status: 403 }
      );
    }
    if (!user.is_active) {
      return HttpResponse.json(
        {
          success: false,
          errorCode: 'ACCOUNT_DEACTIVATED',
          error: 'Your account has been deactivated. Please contact an administrator.',
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Login successful.',
      data: { token: encodeMockToken(user.id), user: toPublicUser(user) },
    });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { fullName: string; email: string; phone: string; password: string };
    const errors: { field: string; message: string }[] = [];

    if (!body.fullName?.trim() || body.fullName.trim().length < 2 || body.fullName.trim().length > 100) {
      errors.push({ field: 'fullName', message: 'Full name must be 2-100 characters.' });
    }
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || !body.email.toLowerCase().endsWith('@maidan.pk')) {
      errors.push({ field: 'email', message: 'Registration is restricted to @maidan.pk company email addresses.' });
    }
    if (!body.phone || !/^\+?[0-9]{7,15}$/.test(body.phone.trim())) {
      errors.push({ field: 'phone', message: 'Phone must be a valid number (7-15 digits, optional leading +).' });
    }
    errors.push(...passwordStrengthErrors('password', body.password ?? ''));

    if (errors.length) return fieldErrorResponse(errors);

    if (findFixtureByEmail(body.email)) {
      return HttpResponse.json(
        { success: false, error: 'An account with this email address already exists.' },
        { status: 400 }
      );
    }

    const newUser: MockUser = {
      id: Math.max(...fixtureUsers.map((u) => u.id)) + 1,
      email: body.email.toLowerCase().trim(),
      password: body.password,
      full_name: body.fullName.trim(),
      phone: body.phone.trim(),
      role: null,
      status: 'pending',
      can_upload: false,
      can_use_ai_chat: false,
      is_active: true,
      is_system_admin: false,
      created_at: new Date().toISOString(),
      approved_at: null,
    };
    addFixtureUser(newUser);

    return HttpResponse.json(
      {
        success: true,
        message: 'Registration received. Your account is pending admin approval.',
        data: { user: toPublicUser(newUser) },
      },
      { status: 201 }
    );
  }),

  http.post('/api/auth/forgot-password', async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    const genericMessage = { success: true, message: 'If that email matches an account, a reset code has been sent.' };

    // The real backend only issues an OTP for a known, approved, active
    // account (see the equivalent branch below, commented out) — correct
    // for testing that security property, but it means you have to remember
    // an exact fixture email just to click through the OTP/reset screens.
    // Mock mode is a UI-testing aid, not a security surface, so here it
    // always issues one regardless of whether the email matches anything.
    //
    // const user = findFixtureByEmail(email ?? '');
    // if (!user || user.status !== 'approved' || !user.is_active) {
    //   return HttpResponse.json(genericMessage);
    // }
    // const devOtp = issueOtp(user.email);

    const devOtp = issueOtp(email ?? '');
    return HttpResponse.json({ ...genericMessage, data: { devOtp } });
  }),

  http.post('/api/auth/reset-password', async ({ request }) => {
    const { email, otp, newPassword } = (await request.json()) as {
      email: string;
      otp: string;
      newPassword: string;
    };

    if (!verifyOtp(email ?? '', otp ?? '')) {
      return HttpResponse.json(
        { success: false, error: 'This reset code is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const errors = passwordStrengthErrors('newPassword', newPassword ?? '');
    if (errors.length) return fieldErrorResponse(errors);

    const user = findFixtureByEmail(email);
    if (user) {
      user.password = newPassword;
      persistFixtureChanges();
    }
    consumeOtp(email);

    return HttpResponse.json({
      success: true,
      message: 'Password has been reset. You can now log in with your new password.',
    });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const user = findAuthedUser(request);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: 'Access denied. No authentication token provided.' },
        { status: 401 }
      );
    }
    // Re-checked against the *current* fixture state on every call, same as
    // the real backend re-validating the DB row per-request — flip a
    // fixture's is_active/status in the browser console mid-session to
    // exercise the session-ended flow.
    if (user.status !== 'approved' || !user.is_active) {
      return HttpResponse.json(
        { success: false, error: 'This account is no longer active. Please contact an administrator.' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ success: true, data: { user: toPublicUser(user) } });
  }),

  http.post('/api/auth/change-password', async ({ request }) => {
    const user = findAuthedUser(request);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: 'Access denied. No authentication token provided.' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (user.password !== currentPassword) {
      return HttpResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 401 });
    }

    const errors = passwordStrengthErrors('newPassword', newPassword ?? '');
    if (errors.length) return fieldErrorResponse(errors);

    user.password = newPassword;
    persistFixtureChanges();
    return HttpResponse.json({ success: true, message: 'Password changed successfully.' });
  }),

  http.get('/api/auth/pending-users', ({ request }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }
    const pending = fixtureUsers.filter((u) => u.status === 'pending').map(toPublicUser);
    return HttpResponse.json({ success: true, data: pending });
  }),

  http.post('/api/auth/pending-users/:id/approve', async ({ request, params }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }

    const { role, canUpload, canUseAiChat } = (await request.json()) as {
      role: string;
      canUpload?: boolean;
      canUseAiChat?: boolean;
    };

    if (role === 'admin' && requester.role !== 'admin') {
      return HttpResponse.json({ success: false, error: 'Only an admin can grant the admin role.' }, { status: 403 });
    }

    const id = Number(params.id);
    const target = fixtureUsers.find((u) => u.id === id && u.status === 'pending');
    if (!target) {
      return HttpResponse.json(
        { success: false, error: 'Pending user not found, or already processed.' },
        { status: 404 }
      );
    }

    target.role = role as MockUser['role'];
    target.status = 'approved';
    target.can_upload = canUpload === true;
    target.can_use_ai_chat = canUseAiChat === true;
    target.approved_at = new Date().toISOString();
    persistFixtureChanges();

    return HttpResponse.json({ success: true, message: 'User approved.', data: { user: toPublicUser(target) } });
  }),

  http.post('/api/auth/pending-users/:id/reject', async ({ request, params }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }

    const id = Number(params.id);
    const target = fixtureUsers.find((u) => u.id === id && u.status === 'pending');
    if (!target) {
      return HttpResponse.json(
        { success: false, error: 'Pending user not found, or already processed.' },
        { status: 404 }
      );
    }

    target.status = 'rejected';
    target.approved_at = new Date().toISOString();
    persistFixtureChanges();

    return HttpResponse.json({ success: true, message: 'User rejected.', data: { user: toPublicUser(target) } });
  }),

  http.get('/api/auth/users', ({ request }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }
    const sorted = [...fixtureUsers].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json({ success: true, data: sorted.map(toPublicUser) });
  }),

  http.patch('/api/auth/users/:id', async ({ request, params }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }

    const { role, canUpload, canUseAiChat, isActive } = (await request.json()) as {
      role?: string;
      canUpload?: boolean;
      canUseAiChat?: boolean;
      isActive?: boolean;
    };

    if (role === 'admin' && requester.role !== 'admin') {
      return HttpResponse.json({ success: false, error: 'Only an admin can grant the admin role.' }, { status: 403 });
    }

    const id = Number(params.id);
    const target = fixtureUsers.find((u) => u.id === id && u.status === 'approved');
    if (!target) {
      return HttpResponse.json({ success: false, error: 'Approved user not found.' }, { status: 404 });
    }

    // Mirrors the guards in controllers/auth.controller.js's updateUser, so
    // mock mode can't allow an edit the real API would reject.
    if (target.is_system_admin && target.id !== requester.id) {
      return HttpResponse.json(
        { success: false, error: 'This account can only be changed by its owner.' },
        { status: 403 }
      );
    }
    if (requester.role !== 'admin' && target.role === 'admin') {
      return HttpResponse.json(
        { success: false, error: "Only an admin can change another admin's settings." },
        { status: 403 }
      );
    }
    const changesRole = role !== undefined && role !== target.role;
    const changesActive = isActive !== undefined && isActive !== target.is_active;
    if (
      target.role === 'admin' &&
      target.id !== requester.id &&
      !requester.is_system_admin &&
      (changesRole || changesActive)
    ) {
      return HttpResponse.json(
        {
          success: false,
          error:
            'Only the system administrator can change another administrator’s role or account status.',
        },
        { status: 403 }
      );
    }

    if (role !== undefined) target.role = role as MockUser['role'];
    if (canUpload !== undefined) target.can_upload = canUpload;
    if (canUseAiChat !== undefined) target.can_use_ai_chat = canUseAiChat;
    if (isActive !== undefined) target.is_active = isActive;
    persistFixtureChanges();

    return HttpResponse.json({ success: true, message: 'User updated.', data: { user: toPublicUser(target) } });
  }),

  http.delete('/api/auth/users/:id', ({ request, params }) => {
    const requester = findAuthedUser(request);
    if (!requester || (requester.role !== 'admin' && requester.role !== 'operations_manager')) {
      return HttpResponse.json(
        { success: false, error: "Access denied. Requires one of the following roles: admin, operations_manager." },
        { status: 403 }
      );
    }

    const id = Number(params.id);
    if (id === requester.id) {
      return HttpResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const target = findFixtureById(id);
    if (!target) {
      return HttpResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
    if (target.is_system_admin) {
      return HttpResponse.json(
        { success: false, error: 'This account cannot be deleted.' },
        { status: 403 }
      );
    }
    if (target.role === 'admin' && !requester.is_system_admin) {
      return HttpResponse.json(
        { success: false, error: 'Only the system administrator can delete an administrator account.' },
        { status: 403 }
      );
    }

    removeFixtureUser(id);
    return HttpResponse.json({ success: true, message: 'User deleted.' });
  }),

  http.get('/api/facilities', () => {
    return HttpResponse.json({
      success: true,
      data: MOCK_FACILITIES.map((f) => ({ id: f.facility_id, code: f.facility_code, name: f.facility_name, location: null })),
    });
  }),

  http.get('/api/sport-types', () => {
    return HttpResponse.json({
      success: true,
      data: MOCK_SPORTS.map((s) => ({ id: s.sport_type_id, name: s.sport_name })),
    });
  }),

  http.get('/api/payment-methods', () => {
    return HttpResponse.json({
      success: true,
      // real payment_methods table never has the synthetic id-0 "Unspecified" row
      data: MOCK_PAYMENT_METHODS.filter((pm) => pm.payment_method_id !== 0).map((pm) => ({
        id: pm.payment_method_id,
        name: pm.payment_method_name,
      })),
    });
  }),

  http.get('/api/dashboard/bookings', ({ request }) => {
    const url = new URL(request.url);
    const csv = (key: string) => (url.searchParams.get(key) ?? '').split(',').filter(Boolean);
    const granularity = (url.searchParams.get('granularity') as Granularity | null) ?? 'daily';
    const binLimit = Math.min(Math.max(parseInt(url.searchParams.get('binLimit') ?? '10', 10) || 10, 1), 100);

    const data = buildBookingsDashboardMock({
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      facilityIds: csv('facilityId'),
      sportTypeIds: csv('sportTypeId'),
      paymentMethodIds: csv('paymentMethodId'),
      granularity: ['daily', 'weekly', 'monthly'].includes(granularity) ? granularity : 'daily',
      binLimit,
    });

    return HttpResponse.json({ success: true, data });
  }),

  http.get('/api/investors', () => {
    return HttpResponse.json({
      success: true,
      data: MOCK_INVESTORS.map((i) => ({ id: i.investor_id, name: i.investor_name, contact_info: i.contact_info })),
    });
  }),

  http.get('/api/dashboard/investors', ({ request }) => {
    const url = new URL(request.url);
    const csv = (key: string) => (url.searchParams.get(key) ?? '').split(',').filter(Boolean);
    const targetMonths = Math.min(Math.max(parseInt(url.searchParams.get('targetMonths') ?? '12', 10) || 12, 1), 120);
    const trailingMonths = Math.min(Math.max(parseInt(url.searchParams.get('trailingMonths') ?? '6', 10) || 6, 1), 36);

    const data = buildInvestorsDashboardMock({
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      facilityIds: csv('facilityId'),
      investorIds: csv('investorId'),
      statuses: csv('status') as InvestorStatus[],
      targetMonths,
      trailingMonths,
    });

    return HttpResponse.json({ success: true, data });
  }),

  http.get('/api/categories', () => {
    return HttpResponse.json({ success: true, data: MOCK_CATEGORIES });
  }),

  http.get('/api/dashboard/expenses/account-references', () => {
    return HttpResponse.json({ success: true, data: getAccountReferenceMock() });
  }),

  // Stands in for the Gemini-backed /api/ai/ask so the ask panel can be
  // exercised without a key. It doesn't attempt to answer anything — it echoes
  // a canned result whose shape matches the real controller, and reproduces the
  // states the panel has to handle: the access gate, the 422 for a question
  // that can't be answered from the reporting tables, and the 500-char cap.
  http.post('/api/ai/ask', async ({ request }) => {
    const user = findAuthedUser(request);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: 'Invalid or expired authentication token.' },
        { status: 401 }
      );
    }
    if (!user.can_use_ai_chat && user.role !== 'admin') {
      return HttpResponse.json(
        { success: false, error: 'You do not have access to the AI assistant.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      question?: string;
      conversationId?: number;
      scope?: 'bookings' | 'expenses' | 'investors';
    };
    const trimmed = (body.question ?? '').trim();
    if (body.conversationId && !getMockConversation(user.id, String(body.conversationId))) {
      return HttpResponse.json({ success: false, error: 'Conversation not found.' }, { status: 404 });
    }
    if (!trimmed) {
      return HttpResponse.json(
        { success: false, error: 'A question is required.', errors: [{ field: 'question', message: 'A question is required.' }] },
        { status: 400 }
      );
    }
    if (trimmed.length > 500) {
      return HttpResponse.json(
        { success: false, error: 'Question must be under 500 characters.' },
        { status: 400 }
      );
    }

    await new Promise((r) => setTimeout(r, 700));

    // Magic questions that exercise the two states the panel can't otherwise
    // reach in mock mode — same trick as RATE_LIMITED_EMAIL on the login
    // handler. 503 is the state a deployment without GEMINI_API_KEY is
    // permanently in, so it needs to be reachable without unsetting a key.
    if (/^trigger:unconfigured$/i.test(trimmed)) {
      return HttpResponse.json(
        { success: false, error: 'The AI chatbot is not configured yet. Set GEMINI_API_KEY to enable it.' },
        { status: 503 }
      );
    }
    if (/^trigger:ratelimit$/i.test(trimmed)) {
      return HttpResponse.json(
        { success: false, error: 'Too many requests, please try again later.' },
        { status: 429, headers: { 'RateLimit-Reset': '45' } }
      );
    }

    if (/password|user|login|email/i.test(trimmed)) {
      // Recorded like the real controller does, so reopening the thread shows
      // the question that didn't land rather than a gap.
      const message = "That can't be answered from the reporting data.";
      appendMockExchange(user.id, body.conversationId ?? null, body.scope, trimmed, null, message);
      return HttpResponse.json({ success: false, error: message }, { status: 422 });
    }

    const answer = {
      question: trimmed,
      answer:
        'Maidan Emaar brought in the most net revenue over the selected window at PKR 4.82M, ahead of KMC at PKR 3.91M and Malir at PKR 3.77M. Emaar also carried the smallest discount burden of the three.',
      sql: 'SELECT f.name, SUM(b.net_amount) AS net_revenue\nFROM bookings b\nJOIN facilities f ON f.id = b.facility_id\nGROUP BY f.name\nORDER BY net_revenue DESC;',
      rowCount: 3,
      rows: [
        { name: 'Maidan Emaar', net_revenue: 4820000 },
        { name: 'Maidan KMC', net_revenue: 3910000 },
        { name: 'Maidan Malir Cantt', net_revenue: 3770000 },
      ],
    };

    const conversationId = appendMockExchange(user.id, body.conversationId ?? null, body.scope, trimmed, answer);
    return HttpResponse.json({ success: true, data: { ...answer, conversationId } });
  }),

  http.get('/api/ai/conversations', ({ request }) => {
    const user = findAuthedUser(request);
    if (!user) return HttpResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    return HttpResponse.json({ success: true, data: listMockConversations(user.id) });
  }),

  http.get('/api/ai/conversations/:id', ({ request, params }) => {
    const user = findAuthedUser(request);
    if (!user) return HttpResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    const conversation = getMockConversation(user.id, String(params.id));
    if (!conversation) {
      return HttpResponse.json({ success: false, error: 'Conversation not found.' }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: conversation });
  }),

  http.delete('/api/ai/conversations/:id', ({ request, params }) => {
    const user = findAuthedUser(request);
    if (!user) return HttpResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    if (!deleteMockConversation(user.id, String(params.id))) {
      return HttpResponse.json({ success: false, error: 'Conversation not found.' }, { status: 404 });
    }
    return HttpResponse.json({ success: true, message: 'Conversation deleted.' });
  }),

  http.get('/api/dashboard/expenses', ({ request }) => {
    const url = new URL(request.url);
    const csv = (key: string) => (url.searchParams.get(key) ?? '').split(',').filter(Boolean);
    const granularity = (url.searchParams.get('granularity') as ExpenseGranularity | null) ?? 'weekly';

    const data = buildExpensesDashboardMock({
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      facilityIds: csv('facilityId'),
      categoryIds: csv('categoryId'),
      subcategoryIds: csv('subcategoryId'),
      paymentMethodIds: csv('paymentMethodId'),
      accountTypes: csv('accountType'),
      bankNames: csv('sourceBank'),
      granularity: granularity === 'monthly' ? 'monthly' : 'weekly',
    });

    return HttpResponse.json({ success: true, data });
  }),
];
