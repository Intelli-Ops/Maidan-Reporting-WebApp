import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/pages/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Banner } from '@/components/ui/Banner';
import { ApiError } from '@/api/client';
import { useToast } from '@/components/ui/Toast';
import * as authApi from '@/api/auth';
import { ArrowRightIcon, HashIcon, LockIcon, MailIcon } from '@/components/ui/icons';

function passwordChecks(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const checks = useMemo(() => passwordChecks(newPassword), [newPassword]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});

    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: 'Reset code must be 6 digits.' });
      return;
    }
    if (checks.some((c) => !c.met)) {
      setFieldErrors({ newPassword: 'Password does not meet the requirements below.' });
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword });
      toast.show('Password has been reset. You can now log in.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors?.length) {
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

  return (
    <AuthShell
      headline="Maidan Reporting App"
      subline="Real-time visibility into bookings, expenses and investor reporting across every location."
    >
      <h1 className="font-heading text-2xl font-semibold text-ink">Reset password</h1>
      <p className="mt-1.5 mb-8 text-sm text-ink-muted">Enter the 6-digit code we emailed you, plus a new password.</p>

      <div className="flex flex-col gap-4">
        {banner && <Banner variant="error">{banner}</Banner>}
        <form className="flex flex-col" onSubmit={handleSubmit}>
          <div className="mb-[18px]">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              icon={<MailIcon />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-[18px]">
            <TextField
              label="Reset code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="123456"
              icon={<HashIcon />}
              className="tracking-[0.4em]"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={fieldErrors.otp}
              hint="Expires 10 minutes after it's requested."
            />
          </div>
          <div className="mb-[26px] flex flex-col gap-2">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              icon={<LockIcon />}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={fieldErrors.newPassword}
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
          <Button type="submit" loading={submitting} className="w-full">
            Reset password
            {!submitting && <ArrowRightIcon />}
          </Button>
        </form>

        <p className="mt-1 text-center text-[12.5px] text-ink-faint">
          Didn't get a code?{' '}
          <Link to="/forgot-password" className="font-medium text-blue hover:text-blue-bright">
            Request a new one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
