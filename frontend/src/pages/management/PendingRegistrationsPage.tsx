import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { CheckCircleIcon, XIcon } from '@/components/ui/icons';
import { ApiError } from '@/api/client';
import { approveUser, listPendingUsers, rejectUser } from '@/api/users';
import { roleLabel } from '@/lib/labels';
import type { User, UserRole } from '@/lib/types';

function appliedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function PendingRegistrationsPage() {
  const { user: currentUser } = useAuth();
  const [pending, setPending] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listPendingUsers();
      setPending(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleResolved(id: number) {
    setPending((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
  }

  const canGrantAdmin = currentUser?.role === 'admin';

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Pending Registrations"
        description="Review new sign-ups, set their role and access, then approve or reject."
        actions={pending && pending.length > 0 ? <StatusBadge label={`${pending.length} waiting`} tone="warning" /> : undefined}
      />

      {error && pending === null ? (
        <div className="card-surface flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div>
            <p className="text-sm font-medium text-ink">Couldn't load pending registrations.</p>
            <p className="mt-1 text-sm text-ink-muted">{error}</p>
          </div>
          <Button variant="secondary" onClick={load} className="h-9 px-4 text-sm">
            Try again
          </Button>
        </div>
      ) : pending === null ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-surface p-6">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-3 h-4 w-64" />
              <Skeleton className="mt-6 h-11 w-full" />
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-soft text-mint">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">All caught up</p>
            <p className="mt-1 text-sm text-ink-muted">No registrations are waiting for review right now.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((u) => (
            <PendingUserCard key={u.id} user={u} canGrantAdmin={canGrantAdmin} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingUserCard({
  user,
  canGrantAdmin,
  onResolved,
}: {
  user: User;
  canGrantAdmin: boolean;
  onResolved: (id: number) => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<UserRole>('viewer');
  const [canUpload, setCanUpload] = useState(false);
  const [canUseAiChat, setCanUseAiChat] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'idle' | 'approving' | 'rejecting'>('idle');
  const [error, setError] = useState<string | null>(null);

  const roleOptions: UserRole[] = canGrantAdmin
    ? ['viewer', 'operations_manager', 'admin']
    : ['viewer', 'operations_manager'];

  async function handleApprove() {
    setError(null);
    setBusy('approving');
    try {
      await approveUser(user.id, { role, canUpload, canUseAiChat });
      toast.show(`${user.full_name} approved as ${roleLabel[role]}.`, 'success');
      onResolved(user.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy('idle');
    }
  }

  async function handleReject() {
    setError(null);
    setBusy('rejecting');
    try {
      await rejectUser(user.id, reason.trim() || undefined);
      toast.show(`${user.full_name}'s registration was rejected.`, 'info');
      onResolved(user.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy('idle');
    }
  }

  return (
    <div className="card-surface p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">{user.full_name}</h3>
        <StatusBadge label="Pending approval" tone="warning" />
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        {user.email}
        {user.phone ? ` · ${user.phone}` : ''}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-faint">Applied {appliedOn(user.created_at)}</p>

      {error && (
        <div className="mt-4">
          <Banner variant="error">{error}</Banner>
        </div>
      )}

      {!rejecting ? (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-label">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={busy !== 'idle'}
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200 ease-[var(--ease-maidan)] focus:border-blue-bright disabled:opacity-50"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue"
              checked={canUpload}
              onChange={(e) => setCanUpload(e.target.checked)}
              disabled={busy !== 'idle'}
            />
            Can upload data
          </label>
          <label className="flex h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue"
              checked={canUseAiChat}
              onChange={(e) => setCanUseAiChat(e.target.checked)}
              disabled={busy !== 'idle'}
            />
            Can use AI assistant
          </label>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== 'idle'}>
              <XIcon className="h-4 w-4" />
              Reject
            </Button>
            <Button variant="primary" onClick={handleApprove} loading={busy === 'approving'} disabled={busy !== 'idle'}>
              <CheckCircleIcon className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <TextField
              label="Reason (optional)"
              placeholder="Shown internally only"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy !== 'idle'}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              disabled={busy !== 'idle'}
            >
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleReject} loading={busy === 'rejecting'} disabled={busy !== 'idle'}>
              Confirm reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
