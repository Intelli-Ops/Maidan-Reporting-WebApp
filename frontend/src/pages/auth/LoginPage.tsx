import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams, type Location } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthTabs } from '@/pages/auth/AuthTabs';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Banner } from '@/components/ui/Banner';
import { ApiError } from '@/api/client';
import { useCountdown } from '@/lib/useCountdown';
import { ArrowRightIcon, LockIcon, MailIcon } from '@/components/ui/icons';

const errorCodeVariant: Record<string, 'error' | 'warning' | 'info'> = {
  INVALID_CREDENTIALS: 'error',
  PENDING_APPROVAL: 'info',
  ACCOUNT_REJECTED: 'error',
  ACCOUNT_DEACTIVATED: 'error',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; variant: 'error' | 'warning' | 'info' } | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined);
  const countdown = useCountdown(retryAfter);

  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const from = (location.state as { from?: Location } | null)?.from;
  const redirectTo = from ? `${from.pathname}${from.search}` : '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setRetryAfter(err.retryAfterSeconds ?? 900);
          setError({ message: err.message, variant: 'warning' });
        } else {
          const variant = (err.errorCode && errorCodeVariant[err.errorCode]) || 'error';
          setError({ message: err.message, variant });
        }
      } else {
        setError({ message: 'Something went wrong. Please try again.', variant: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rateLimited = countdown > 0;

  return (
    <AuthShell
      headline="Maidan Reporting App"
      subline="Real-time visibility into bookings, expenses and investor reporting across every location."
    >
      <AuthTabs active="signin" />
      <h1 className="font-heading text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1.5 mb-8 text-sm text-ink-muted">Sign in to your reporting dashboard.</p>

      <div className="flex flex-col gap-4">
        {sessionExpired && !error && (
          <Banner variant="warning">Your session has ended. Please log in again.</Banner>
        )}
        {error && (
          <Banner variant={error.variant}>
            {error.message}
            {rateLimited && ` Try again in ${countdown}s.`}
          </Banner>
        )}

        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="mb-[18px]">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              icon={<MailIcon />}
              placeholder="name@maidan.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              icon={<LockIcon />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="mb-[26px] mt-1 flex justify-end">
            <Link to="/forgot-password" className="text-[13px] font-medium text-blue hover:text-blue-bright">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={submitting} disabled={rateLimited} className="w-full">
            {rateLimited ? `Try again in ${countdown}s` : 'Sign in'}
            {!rateLimited && !submitting && <ArrowRightIcon />}
          </Button>
        </form>

        <p className="mt-1 text-center text-[12.5px] text-ink-faint">
          Need access?{' '}
          <Link to="/register" className="font-medium text-blue hover:text-blue-bright">
            Contact your admin
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
