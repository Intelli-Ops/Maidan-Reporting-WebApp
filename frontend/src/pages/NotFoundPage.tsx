import { Link } from 'react-router-dom';
import { CourtLines } from '@/components/ui/CourtLines';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <CourtLines className="h-32 w-48 opacity-70" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">404</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-ink">This page doesn't exist</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
          The page you're looking for was moved, renamed, or never existed.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded-md bg-[linear-gradient(135deg,#185FA5,#3B6D11)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(24,95,165,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(24,95,165,0.3)]"
      >
        Back to overview
      </Link>
    </div>
  );
}
