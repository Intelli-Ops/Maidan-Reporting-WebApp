// Shared across every dashboard's filter bar (Bookings/Expenses/Investors)
// so "clear filters" looks and behaves identically everywhere.
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-red/30 hover:bg-red-soft hover:text-red"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
      Clear filters
    </button>
  );
}
