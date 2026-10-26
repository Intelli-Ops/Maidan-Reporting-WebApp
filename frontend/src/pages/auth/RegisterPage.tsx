import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthTabs } from '@/pages/auth/AuthTabs';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Banner } from '@/components/ui/Banner';
import { CourtLines } from '@/components/ui/CourtLines';
import { ApiError } from '@/api/client';
import { useCountdown } from '@/lib/useCountdown';
import * as authApi from '@/api/auth';
import { ArrowRightIcon, LockIcon, MailIcon, PhoneIcon, UserIcon } from '@/components/ui/icons';

const EMAIL_DOMAIN = '@maidan.pk';
// Mirrors the backend's REQUIRE_COMPANY_EMAIL toggle (config/index.js) —
// pre-launch, before real @maidan.pk mailboxes exist, both sides accept any
// address. Set VITE_REQUIRE_COMPANY_EMAIL=false locally (see .env.local) to
// match; flip both back once real company email is available.
const REQUIRE_COMPANY_EMAIL = import.meta.env.VITE_REQUIRE_COMPANY_EMAIL !== 'false';

function passwordChecks(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];
}

export function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined);
  const countdown = useCountdown(retryAfter);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const emailValidDomain =
    !REQUIRE_COMPANY_EMAIL || email.length === 0 || email.toLowerCase().trim().endsWith(EMAIL_DOMAIN);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});

    if (REQUIRE_COMPANY_EMAIL && !email.toLowerCase().trim().endsWith(EMAIL_DOMAIN)) {
      setFieldErrors({ email: `Registration is restricted to ${EMAIL_DOMAIN} company email addresses.` });
      return;
    }
    if (checks.some((c) => !c.met)) {
      setFieldErrors({ password: 'Password does not meet the requirements below.' });
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({ fullName, email, phone, password });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setRetryAfter(err.retryAfterSeconds ?? 3600);
          setBanner(err.message);
        } else if (err.fieldErrors?.length) {
          setFieldErrors(err.fieldErrorMap());
        } else {
          setBanner(err.message);
        }
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
            <h1 className="font-heading text-2xl font-semibold text-ink">Registration received</h1>
            <p className="mt-1.5 text-sm text-ink-muted">Your account is pending admin approval.</p>
          </div>
          <p className="text-sm text-ink-muted">
            An administrator needs to approve your account before you can sign in. You'll be able to log in as soon
            as that happens. No further action is needed from you right now.
          </p>
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
      <AuthTabs active="signup" />
      <h1 className="font-heading text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1.5 mb-8 text-sm text-ink-muted">Set up access to the reporting dashboard.</p>

      <div className="flex flex-col gap-4">
        {banner && <Banner variant="warning">{banner}{rateLimited && ` Try again in ${countdown}s.`}</Banner>}

        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="mb-[18px]">
            <TextField
              label="Full name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              icon={<UserIcon />}
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={fieldErrors.fullName}
            />
          </div>
          <div className="mb-[18px]">
            <TextField
              label="Work email"
              type="email"
              autoComplete="email"
              required
              icon={<MailIcon />}
              placeholder={REQUIRE_COMPANY_EMAIL ? `you${EMAIL_DOMAIN}` : 'you@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email ?? (!emailValidDomain ? `Must end with ${EMAIL_DOMAIN}` : undefined)}
            />
          </div>
          <div className="mb-[18px]">
            <TextField
              label="Phone"
              type="tel"
              autoComplete="tel"
              required
              icon={<PhoneIcon />}
              placeholder="+923001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={fieldErrors.phone}
            />
          </div>
          <div className="mb-[26px] flex flex-col gap-2">
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              icon={<LockIcon />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
            <ul className="flex flex-col gap-1">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-1.5 text-xs ${c.met ? 'text-mint' : 'text-ink-muted'}`}
                >
                  <span className={`h-1 w-1 rounded-full ${c.met ? 'bg-mint' : 'bg-border'}`} />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          <Button type="submit" loading={submitting} disabled={rateLimited} className="w-full">
            {rateLimited ? `Try again in ${countdown}s` : 'Create account'}
            {!rateLimited && !submitting && <ArrowRightIcon />}
          </Button>
        </form>

        <p className="mt-1 text-center text-[12.5px] text-ink-faint">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue hover:text-blue-bright">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
