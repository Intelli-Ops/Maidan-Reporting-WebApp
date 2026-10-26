// Visible-everywhere indicator that the app is running against fixture data
// (npm run dev:mock), not the real backend — so a screenshot or a live demo
// is never mistaken for real account/session state.
export function MockModeBadge() {
  if (!(import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true')) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[100] -translate-x-1/2 px-2">
      <span className="whitespace-nowrap rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber shadow-sm sm:text-[11px]">
        Mock mode: fixture data
      </span>
    </div>
  );
}
