import type { FieldError } from '@/lib/types';

// Where the API lives.
//
// Dev: unset, so this falls back to '/api' — a relative path that
// vite.config.ts proxies to http://localhost:5000. Nothing about local
// development changes.
//
// Prod: the frontend is deployed separately from the API, so there is no
// proxy and a relative '/api' would resolve against the frontend's own
// host and 404. Set VITE_API_BASE_URL to the API's absolute origin, e.g.
// https://api.maidan.pk/api
//
// Trailing slashes are stripped so both '.../api' and '.../api/' work —
// paths passed to apiRequest already start with '/'.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

const TOKEN_KEY = 'maidan.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Dispatched when a request fails because the *session itself* is invalid —
// AuthContext listens for this to clear session state and redirect to
// /login?reason=session_expired, since the backend re-validates status/flags
// on every request rather than trusting JWT claims (a revoked account hits
// this on its very next call).
export const SESSION_EXPIRED_EVENT = 'maidan:session-expired';

// middleware/auth.js tags every failure of the SESSION ITSELF with this code —
// as opposed to a 401/403 from business logic on an otherwise-valid session,
// e.g. change-password's "Current password is incorrect." (401) or
// authorizeRoles' "Access denied. Requires one of the following roles…" (403),
// neither of which should log anyone out.
const SESSION_INVALID_CODE = 'SESSION_INVALID';

// Fallback for a backend that predates the code above. It is missing the
// "your password was changed" case on purpose — that message is exactly what
// this list failing to keep up with the server looked like in practice: after
// changing their password a user sat in a dead session, every request 401ing
// with nothing ever sending them back to login. Match on the code; this is
// only here so an older server keeps working.
const LEGACY_SESSION_INVALID_MESSAGES = new Set([
  'Access denied. No authentication token provided.',
  'Invalid or expired authentication token.',
  'This account is no longer active. Please contact an administrator.',
]);

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  fieldErrors?: FieldError[];
  retryAfterSeconds?: number;

  constructor(
    message: string,
    opts: { status: number; errorCode?: string; fieldErrors?: FieldError[]; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.fieldErrors = opts.fieldErrors;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  // Collapses express-validator's per-field errors into a lookup so a form
  // can attach the right message under the right input.
  fieldErrorMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const fe of this.fieldErrors ?? []) {
      if (!(fe.field in map)) map[fe.field] = fe.message;
    }
    return map;
  }
}

interface ApiEnvelope {
  success: boolean;
  message?: string;
  error?: string;
  errorCode?: string;
  errors?: FieldError[];
  data?: unknown;
}

function parseRetryAfterSeconds(res: Response): number | undefined {
  // express-rate-limit's draft-7 standardHeaders expose seconds-until-reset.
  const reset = res.headers.get('RateLimit-Reset') ?? res.headers.get('Retry-After');
  if (!reset) return undefined;
  const seconds = Number(reset);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; skipAuth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, skipAuth = false } = options;
  const isFormData = body instanceof FormData;

  // Never set Content-Type ourselves for FormData — the browser has to add
  // the multipart boundary, which it only does if the header is left unset.
  const headers: Record<string, string> = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (!skipAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', { status: 0 });
  }

  let envelope: ApiEnvelope | undefined;
  try {
    envelope = await res.json();
  } catch {
    // No JSON body (e.g. some 204s) — fall through with envelope undefined.
  }

  const sessionInvalid =
    envelope?.errorCode === SESSION_INVALID_CODE ||
    LEGACY_SESSION_INVALID_MESSAGES.has(envelope?.error ?? '');

  if (!skipAuth && (res.status === 401 || res.status === 403) && sessionInvalid) {
    clearToken();
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  if (!res.ok) {
    throw new ApiError(envelope?.error ?? `Request failed with status ${res.status}.`, {
      status: res.status,
      errorCode: envelope?.errorCode,
      fieldErrors: envelope?.errors,
      retryAfterSeconds: res.status === 429 ? parseRetryAfterSeconds(res) : undefined,
    });
  }

  return envelope as T;
}
