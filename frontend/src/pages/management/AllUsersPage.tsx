import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ChartCard } from '@/components/reporting/ChartCard';
import { DataTable, type DataTableColumn } from '@/components/reporting/DataTable';
import { SegmentedControl } from '@/components/reporting/SegmentedControl';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PencilIcon, SearchIcon, TrashIcon } from '@/components/ui/icons';
import { ApiError } from '@/api/client';
import { deleteUser, listAllUsers, updateUser } from '@/api/users';
import { roleLabel, statusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { User, UserRole, UserStatus } from '@/lib/types';

type StatusFilter = 'all' | UserStatus;

const statusTone: Record<UserStatus, 'success' | 'warning' | 'error'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
};

// Reuses StatusBadge's existing tones rather than inventing new colors — the
// role column doubles as a quick visual scan across the table (an admin row
// should read differently from a viewer row at a glance), without adding any
// color the rest of the app doesn't already use.
const roleTone: Record<UserRole, 'info' | 'success' | 'neutral'> = {
  admin: 'info',
  operations_manager: 'success',
  viewer: 'neutral',
};

// Same role -> color mapping, as a solid fill instead of a soft one — used on
// the avatar bubble so identity and role read together at a glance.
const roleAvatarStyle: Record<UserRole, string> = {
  admin: 'bg-blue text-white',
  operations_manager: 'bg-mint text-white',
  viewer: 'bg-ink/12 text-ink-muted',
};

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function UserIdentity({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
          roleAvatarStyle[user.role ?? 'viewer']
        )}
        aria-hidden
      >
        {initials(user.full_name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{user.full_name}</p>
        <p className="truncate text-[12.5px] text-ink-muted">{user.email}</p>
      </div>
    </div>
  );
}

function YesNoDot({ value, yesLabel = 'Yes', noLabel = 'No' }: { value: boolean; yesLabel?: string; noLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', value ? 'bg-mint' : 'bg-border')} />
      {value ? yesLabel : noLabel}
    </span>
  );
}

export function AllUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listAllUsers();
      setUsers(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, statusFilter, search]);

  const editingUser = editingId != null ? (users?.find((u) => u.id === editingId) ?? null) : null;
  const deletingUser = deletingId != null ? (users?.find((u) => u.id === deletingId) ?? null) : null;

  function handleUpdated(updated: User) {
    setUsers((prev) => (prev ? prev.map((u) => (u.id === updated.id ? updated : u)) : prev));
    setEditingId(null);
  }

  function handleDeleted(id: number) {
    setUsers((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
    setDeletingId(null);
  }

  const canGrantAdmin = currentUser?.role === 'admin';
  // An operations_manager can manage everyone except an existing admin — see
  // the matching guard in controllers/auth.controller.js's updateUser. Only
  // affects rows that are ALREADY admin; granting admin to someone else is a
  // separate check (canGrantAdmin, inside EditUserForm).
  const canManageAdmins = currentUser?.role === 'admin';
  // Re-grading an existing admin (role, or active status, or deletion) is
  // reserved to the system administrator. Everything below only hides the
  // controls; the API applies the same rules and is the actual boundary.
  const canRegradeAdmins = currentUser?.is_system_admin === true;

  const columns: DataTableColumn<User>[] = [
    {
      key: 'user',
      label: 'User',
      render: (u) => <UserIdentity user={u} />,
    },
    {
      key: 'role',
      label: 'Role',
      align: 'center',
      render: (u) =>
        u.is_system_admin ? (
          // Deliberately a different tone from the blue admin pill — the two
          // are different tiers and shouldn't read as the same badge.
          <StatusBadge label="System Admin" tone="slate" />
        ) : u.role ? (
          <StatusBadge label={roleLabel[u.role]} tone={roleTone[u.role]} />
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (u) => <StatusBadge label={statusLabel[u.status]} tone={statusTone[u.status]} />,
    },
    { key: 'upload', label: 'Upload', align: 'center', render: (u) => <YesNoDot value={u.can_upload} /> },
    { key: 'ai', label: 'AI assistant', align: 'center', render: (u) => <YesNoDot value={u.can_use_ai_chat} /> },
    {
      key: 'active',
      label: 'Account',
      align: 'center',
      render: (u) => <YesNoDot value={u.is_active} yesLabel="Active" noLabel="Deactivated" />,
    },
    { key: 'since', label: 'Member since', render: (u) => memberSince(u.created_at) },
    {
      key: 'actions',
      label: '',
      render: (u) => {
        const isSelf = u.id === currentUser?.id;
        // Locked out entirely, not just from granting admin — an
        // operations_manager can't edit or delete an account that's already
        // an admin, mirroring the server-side guard exactly.
        const isProtectedAdmin = u.role === 'admin' && !canManageAdmins;
        // The system administrator's row is editable only by its owner, and
        // is not deletable by anyone.
        const isOthersSystemRow = u.is_system_admin && !isSelf;
        return (
          <div className="flex items-center gap-1">
            {u.status === 'approved' && !isProtectedAdmin && !isOthersSystemRow && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingId(u.id)}
                aria-label={`Edit ${u.full_name}`}
              >
                <PencilIcon className="h-4 w-4 shrink-0" />
              </Button>
            )}
            {!isSelf && !isProtectedAdmin && !u.is_system_admin && !(u.role === 'admin' && !canRegradeAdmins) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingId(u.id)}
                aria-label={`Delete ${u.full_name}`}
              >
                <TrashIcon className="h-4 w-4 shrink-0 text-red" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="All Users"
        description="Every account across the app. Edit role and access for approved accounts."
      />

      <div className="flex flex-col gap-6">
        <div className="card-surface flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Search</span>
            <div className="flex h-9 w-56 items-center gap-2 rounded-full border border-border bg-surface-muted px-3.5 transition-colors duration-200 ease-[var(--ease-maidan)] focus-within:border-blue-bright">
              <SearchIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or email"
                className="h-full flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div aria-hidden className="h-6 w-px shrink-0 bg-border" />

          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Status</span>
            <SegmentedControl
              dividers
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'approved', label: 'Approved' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        <ChartCard title="Accounts" description={users ? `${filtered.length} of ${users.length} shown` : undefined}>
          {users === null ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <DataTable
              gridlines
              columns={columns}
              rows={filtered}
              rowKey={(u) => u.id}
              emptyMessage="No accounts match your filters."
            />
          )}
        </ChartCard>

        <Modal
          open={editingUser != null}
          onClose={() => setEditingId(null)}
          title={editingUser ? `Edit ${editingUser.full_name}` : ''}
          description={editingUser?.email}
        >
          {editingUser && (
            <EditUserForm
              key={editingUser.id}
              user={editingUser}
              canGrantAdmin={canGrantAdmin}
              canRegrade={
                editingUser.id === currentUser?.id ||
                editingUser.role !== 'admin' ||
                canRegradeAdmins
              }
              onCancel={() => setEditingId(null)}
              onSaved={handleUpdated}
            />
          )}
        </Modal>

        <Modal
          open={deletingUser != null}
          onClose={() => setDeletingId(null)}
          title={deletingUser ? `Delete ${deletingUser.full_name}?` : ''}
          description="This permanently removes the account. This can't be undone."
        >
          {deletingUser && (
            <DeleteUserDialog
              key={deletingUser.id}
              user={deletingUser}
              onCancel={() => setDeletingId(null)}
              onDeleted={handleDeleted}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}

function EditUserForm({
  user,
  canGrantAdmin,
  canRegrade,
  onCancel,
  onSaved,
}: {
  user: User;
  canGrantAdmin: boolean;
  // False when this row is another admin and the signed-in user is not the
  // system administrator: upload and AI-assistant rights stay editable, role
  // and account status do not.
  canRegrade: boolean;
  onCancel: () => void;
  onSaved: (u: User) => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<UserRole>(user.role ?? 'viewer');
  const [canUpload, setCanUpload] = useState(user.can_upload);
  const [canUseAiChat, setCanUseAiChat] = useState(user.can_use_ai_chat);
  const [isActive, setIsActive] = useState(user.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions: UserRole[] = canGrantAdmin
    ? ['viewer', 'operations_manager', 'admin']
    : ['viewer', 'operations_manager'];

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await updateUser(user.id, { role, canUpload, canUseAiChat, isActive });
      toast.show(`${user.full_name} updated.`, 'success');
      onSaved(res.data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner variant="error">{error}</Banner>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {!canRegrade && (
          <Banner variant="info">
            Role and account status for an administrator can only be changed by
            the system administrator.
          </Banner>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-label">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={saving || !canRegrade}
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200 ease-[var(--ease-maidan)] focus:border-blue-bright disabled:opacity-50"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue"
              checked={canUpload}
              onChange={(e) => setCanUpload(e.target.checked)}
              disabled={saving}
            />
            Can upload data
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue"
              checked={canUseAiChat}
              onChange={(e) => setCanUseAiChat(e.target.checked)}
              disabled={saving}
            />
            Can use AI assistant
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={saving || !canRegrade}
            />
            Account active
          </label>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserDialog({
  user,
  onCancel,
  onDeleted,
}: {
  user: User;
  onCancel: () => void;
  onDeleted: (id: number) => void;
}) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteUser(user.id);
      toast.show(`${user.full_name} was deleted.`, 'success');
      onDeleted(user.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Banner variant="error">{error}</Banner>
        </div>
      )}
      <p className="text-[13px] text-ink-muted">{user.email}</p>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={deleting}>
          Delete permanently
        </Button>
      </div>
    </div>
  );
}
