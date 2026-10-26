import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
}

export function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const summary =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? '1 selected')
        : `${selected.length} selected`;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-150',
          selected.length > 0 ? 'bg-[#d9e9f8] text-blue' : 'bg-[#e7eae3] text-ink-muted hover:text-ink'
        )}
      >
        {summary}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-56 overflow-y-auto rounded-2xl border border-black/[0.04] bg-surface p-1.5 shadow-[0_4px_12px_rgb(16_24_40_/_0.06),0_16px_40px_-8px_rgb(16_24_40_/_0.16)]">
          {options.length === 0 && <p className="px-2.5 py-1.5 text-xs text-ink-muted">No options.</p>}
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-ink hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="accent-blue"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
