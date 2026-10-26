import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '@/pages/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Banner } from '@/components/ui/Banner';
import { CourtLines } from '@/components/ui/CourtLines';
import { ApiError } from '@/api/client';
import { useCountdown } from '@/lib/useCountdown';
import * as authApi from '@/api/auth';
import { ArrowRightIcon, MailIcon } from '@/components/ui/icons';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined);
  const countdown = useCountdown(retryAfter);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRetryAfter(err.retryAfterSeconds ?? 900);
        setBanner(err.message);
      } else if (err instanceof ApiError) {
        setBanner(err.message);
      } else {
        setBanner('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const rateLimited = countdown > 0;

  if (submitted) {
    return (
      <AuthShell
        headline="Maidan Reporting App"
        subline="Real-time visibility into bookings, expenses and investor reporting across every location."
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <CourtLines className="h-32 w-48 opacity-70" />
          <div>
            <h1 className="font-heading text-2xl font-semibold text-ink">Check your email</h1>
            <p className="mt-1.5 text-sm text-ink-muted">If that email matches an account, a reset code is on its way.</p>
          </div>
          <p className="text-sm text-ink-muted">
            The code expires in 10 minutes. Enter it on the next screen along with your new password.
          </p>
          <Button className="w-full" onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}>
            Enter reset code
            <ArrowRightIcon />
          </Button>
          <Link to="/login" className="text-sm font-medium text-blue hover:text-blue-bright">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      headline="Maidan Reporting App"
      subline="Real-time visibility into bookings, expenses and investor reporting across every location."
    >
      <h1 className="font-heading text-2xl font-semibold text-ink">Forgot password</h1>
      <p className="mt-1.5 mb-8 text-sm text-ink-muted">Enter your email and we'll send you a reset code.</p>

      <div className="flex flex-col gap-4">
        {banner && <Banner variant="warning">{banner}{rateLimited && ` Try again in ${countdown}s.`}</Banner>}
        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="mb-[26px]">
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
          <Button type="submit" loading={submitting} disabled={rateLimited} className="w-full">
            {rateLimited ? `Try again in ${countdown}s` : 'Send reset code'}
            {!rateLimited && !submitting && <ArrowRightIcon />}
          </Button>
        </form>

        <Link to="/login" className="mt-1 text-center text-[12.5px] font-medium text-blue hover:text-blue-bright">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
