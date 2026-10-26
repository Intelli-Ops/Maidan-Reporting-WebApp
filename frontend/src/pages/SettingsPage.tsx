import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/api/client';
import { roleLabel, statusLabel } from '@/lib/labels';
import { LockIcon, MailIcon, PhoneIcon, UploadCloudIcon, SparkleIcon } from '@/components/ui/icons';
import * as authApi from '@/api/auth';

function passwordChecks(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Same glass-chip treatment as HeroCard's period chips — a soft translucent
// pill that stays readable over the gradient without competing with it.
function GlassChip({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/14 bg-white/8 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-md">
      {children}
    </span>
  );
}

function ProfileField({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-ink">{value}</div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const checks = useMemo(() => passwordChecks(newPassword), [newPassword]);

  if (!user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});

    if (checks.some((c) => !c.met)) {
      setFieldErrors({ newPassword: 'Password does not meet the requirements below.' });
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast.show('Password changed successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
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
    <div>
      <PageHeader eyebrow="Settings" title="Profile & Settings" description="Your account details and password." />

      <div className="flex flex-col gap-6">
        {/* Same gradient + line-art language as the overview page's spotlight
            card, applied here as a premium identity header instead of a
            plain label/value grid — role, status and tenure read as a set of
            glass chips at a glance instead of six separate stacked fields. */}
        <div
          className="relative flex flex-col gap-6 overflow-hidden rounded-lg px-8 py-8 text-white sm:flex-row sm:items-center sm:px-10 sm:py-9"
          style={{ background: 'linear-gradient(135deg, #185FA5, #3B6D11)' }}
        >
          <svg
            viewBox="0 0 400 260"
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 opacity-15"
          >
            <rect x="20" y="20" width="360" height="220" rx="4" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="200" cy="130" r="60" stroke="white" strokeWidth="1.5" fill="none" />
            <line x1="200" y1="20" x2="200" y2="240" stroke="white" strokeWidth="1" />
          </svg>

          <span className="relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/12 font-display text-2xl font-bold text-white backdrop-blur-md">
            {initials(user.full_name)}
          </span>

          <div className="relative z-10 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Signed in as</p>
            <h2 className="mt-1 truncate font-heading text-2xl font-semibold tracking-tight text-white">
              {user.full_name}
            </h2>
            <p className="mt-1 truncate text-sm text-white/70">{user.email}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <GlassChip>{user.role ? roleLabel[user.role] : '—'}</GlassChip>
              <GlassChip>{statusLabel[user.status]}</GlassChip>
              <GlassChip>
                Member since{' '}
                {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
              </GlassChip>
            </div>
          </div>
        </div>

        <section className="card-surface p-7">
          <h2 className="font-heading text-[17px] font-semibold tracking-tight text-ink">Contact & access</h2>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ProfileField icon={<MailIcon className="h-4 w-4" />} label="Email" value={user.email} />
            <ProfileField icon={<PhoneIcon className="h-4 w-4" />} label="Phone" value={user.phone ?? '—'} />
            <ProfileField
              icon={<UploadCloudIcon className="h-4 w-4" />}
              label="Upload access"
              value={
                <StatusBadge
                  label={user.can_upload ? 'Enabled' : 'Not enabled'}
                  tone={user.can_upload ? 'success' : 'neutral'}
                />
              }
            />
            <ProfileField
              icon={<SparkleIcon className="h-4 w-4" />}
              label="AI assistant access"
              value={
                <StatusBadge
                  label={user.can_use_ai_chat ? 'Enabled' : 'Not enabled'}
                  tone={user.can_use_ai_chat ? 'success' : 'neutral'}
                />
              }
            />
          </div>
        </section>

        <section className="card-surface p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
              <LockIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-heading text-[17px] font-semibold tracking-tight text-ink">Change password</h2>
              <p className="text-[13px] text-ink-muted">You'll need your current password to set a new one.</p>
            </div>
          </div>

          <form className="mt-6 flex max-w-sm flex-col gap-4" onSubmit={handleSubmit}>
            {banner && <Banner variant="error">{banner}</Banner>}
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                required
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
            <Button type="submit" loading={submitting} className="mt-2 self-start">
              Update password
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
