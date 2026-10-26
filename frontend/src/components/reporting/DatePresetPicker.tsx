import { useEffect, useRef, useState } from 'react';
import { DATE_PRESETS, type DatePresetKey } from '@/lib/datePresets';
import { formatDateLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

// Custom-range inputs render in an anchored popover (same pattern as
// FilterMultiSelect's dropdown) instead of expanding inline in the filter
// bar's flex row — inline expansion pushed the Facilities/Sports/Payment
// Method controls onto a second line whenever Custom was selected, since
// the row ran out of width. A popover overlays instead of reflowing, so the
// bar's height/layout stays constant regardless of which preset is active.
export function DatePresetPicker({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onCustomRange,
  presets = DATE_PRESETS,
  validateRange,
}: {
  preset: DatePresetKey;
  startDate: string | null;
  endDate: string | null;
  onPresetChange: (key: DatePresetKey) => void;
  onCustomRange: (start: string | null, end: string | null) => void;
  /** Defaults to the shared preset set; Bookings passes its narrower 1-3 month list. */
  presets?: { key: DatePresetKey; label: string }[];
  /** Returns a message when the custom range is not allowed, or null when it is. */
  validateRange?: (start: string | null, end: string | null) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const rangeError = validateRange ? validateRange(startDate, endDate) : null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function selectPreset(key: DatePresetKey) {
    onPresetChange(key);
    setOpen(key === 'custom');
  }

  const activeClass = 'bg-[#d9e9f8] text-blue';

  return (
    // h-9 to match FilterMultiSelect exactly, so the two sit on one baseline.
    <div className="flex h-9 items-center gap-0.5 rounded-full bg-[#e7eae3] px-1" ref={ref}>
      {presets.map((p, i) => {
        const showDividerAfter = i < presets.length - 1;

        return (
          <div key={p.key} className="flex items-center gap-0.5">
            {p.key === 'custom' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => selectPreset(p.key)}
                  className={cn(
                    'flex h-7 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-maidan)]',
                    preset === p.key ? activeClass : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {preset === 'custom' && startDate && endDate
                    ? `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`
                    : p.label}
                </button>

                {open && preset === 'custom' && (
                  <div className="absolute left-0 top-full z-20 mt-2 rounded-2xl border border-black/[0.04] bg-surface p-3 shadow-[0_4px_12px_rgb(16_24_40_/_0.06),0_16px_40px_-8px_rgb(16_24_40_/_0.16)]">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={startDate ?? ''}
                        onChange={(e) => onCustomRange(e.target.value || null, endDate)}
                        className="h-9 rounded-full border border-border bg-surface-muted px-3.5 text-sm text-ink"
                      />
                      <span className="text-ink-faint">–</span>
                      <input
                        type="date"
                        value={endDate ?? ''}
                        onChange={(e) => onCustomRange(startDate, e.target.value || null)}
                        className="h-9 rounded-full border border-border bg-surface-muted px-3.5 text-sm text-ink"
                      />
                      <button
                        type="button"
                        // Blocked rather than hidden while invalid: the user
                        // has typed something concrete, so explaining why it
                        // won't apply beats silently doing nothing.
                        disabled={rangeError != null}
                        onClick={() => setOpen(false)}
                        className="ml-1 whitespace-nowrap rounded-full bg-blue px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Apply
                      </button>
                    </div>
                    {rangeError && (
                      <p className="mt-2 max-w-[320px] text-[11px] leading-snug text-red">{rangeError}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => selectPreset(p.key)}
                className={cn(
                  'flex h-7 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-maidan)]',
                  preset === p.key ? activeClass : 'text-ink-muted hover:text-ink'
                )}
              >
                {p.label}
              </button>
            )}
            {showDividerAfter && <span aria-hidden className="h-4 w-px shrink-0 bg-black/[0.08]" />}
          </div>
        );
      })}
    </div>
  );
}
