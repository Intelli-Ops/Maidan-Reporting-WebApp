import { Link } from 'react-router-dom';

export function ExceptionsStrip({
  count,
  message,
  href,
}: {
  count: number;
  message: string;
  href: string;
}) {
  if (count <= 0) return null;

  return (
    <Link
      to={href}
      className="flex items-center justify-between gap-4 rounded-lg border border-amber/25 bg-amber-soft px-5 py-4 transition-colors duration-200 hover:border-amber/40"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/15 text-sm font-semibold tabular-nums text-amber">
          {count}
        </span>
        <p className="text-sm text-ink">
          <span className="font-medium">{count === 1 ? 'One item needs' : `${count} items need`}</span> attention:{' '}
          {message}
        </p>
      </div>
      <span aria-hidden="true" className="text-sm font-medium text-amber">
        Review →
      </span>
    </Link>
  );
}
