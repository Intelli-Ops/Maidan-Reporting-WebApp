import { cn } from '@/lib/utils';

export interface GranularityOption<T extends string> {
  value: T;
  label: string;
}

// Deliberately distinct from SegmentedControl's filled-pill look — this
// toggle sits inside a chart card, not the global filter bar, so a lighter
// divider-separated style ("Daily | Weekly | Monthly") reads as a chart
// option rather than another filter to scan.
export function GranularityToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (g: T) => void;
  options: GranularityOption<T>[];
}) {
  return (
    <div className="flex items-center text-sm">
      {options.map((opt, i) => (
        <div key={opt.value} className="flex items-center">
          {i > 0 && <span className="mx-2.5 text-border">|</span>}
          <button
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'font-medium transition-colors duration-150',
              value === opt.value ? 'text-blue' : 'text-ink-muted hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        </div>
      ))}
    </div>
  );
}
