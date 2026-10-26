import { useAuth } from '@/auth/AuthContext';
import { roleLabel } from '@/lib/labels';

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Topbar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-end border-b border-border bg-surface px-6 shadow-[0_1px_2px_rgb(16_24_40_/_0.04)]">
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-ink">{user.full_name}</p>
          <p className="text-xs text-ink-muted">{user.role ? roleLabel[user.role] : ''}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[13px] font-semibold text-blue">
          {initialsFor(user.full_name)}
        </div>
        <div className="h-6 w-px bg-border" />
        <button
          onClick={logout}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
