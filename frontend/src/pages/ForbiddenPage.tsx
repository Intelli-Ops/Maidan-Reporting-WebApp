import { Link } from 'react-router-dom';
import { CourtLines } from '@/components/ui/CourtLines';

export function ForbiddenPage({ reason }: { reason?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <CourtLines className="h-32 w-48 opacity-70" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Access restricted</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-ink">You don't have access to this yet</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
          {reason ?? "Your account doesn't have permission to view this page. If you think this is a mistake, contact an administrator."}
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted"
      >
        Back to overview
      </Link>
    </div>
  );
}
