import { cn } from '@/lib/utils';

// The design system's signature motif: thin, low-opacity court geometry used
// in empty states, error states, and occasional brand moments — never as
// wallpaper. A single curved line creates movement through negative space.
export function CourtLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      aria-hidden="true"
      className={cn('text-ink', className)}
    >
      <rect x="20" y="20" width="200" height="120" rx="4" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="120" y1="20" x2="120" y2="140" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="120" cy="80" r="28" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <path
        d="M10 130 C 70 60, 150 140, 230 40"
        stroke="var(--color-blue)"
        strokeOpacity="0.18"
        strokeWidth="1.5"
        strokeLinecap="round"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-safe:animate-[draw-line_900ms_var(--ease-maidan)_forwards]"
      />
    </svg>
  );
}
