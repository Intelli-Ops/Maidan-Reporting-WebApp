import { useEffect, useRef, useState } from 'react';
import { ChartCard } from '@/components/reporting/ChartCard';
import { formatCurrency, formatDateWithYear } from '@/lib/format';
import type { InvestorsForecast } from '@/lib/types/investorsDashboard';
import { cn } from '@/lib/utils';

// The forecast reads as a sentence — "at this pace, from this much still owed,
// you finish here" — so the panel is laid out as that chain rather than as a
// flat row of five equal tiles. The three inputs sit together on the left, the
// conclusion gets a card of its own on the right, and the target calculator is
// separated below because it answers a different question (what WOULD it take)
// from the four above it (what IS happening).
function ForecastStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4',
        accent ? 'bg-blue-soft/60 ring-1 ring-blue/15' : 'bg-surface-muted/60'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-heading text-[20px] font-semibold leading-tight tracking-tight tabular-nums',
          accent ? 'text-blue' : 'text-ink'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * Number field that holds what you typed until you're done typing it.
 *
 * Binding the input straight to the committed number made it unusable from the
 * keyboard: `Number('') || min` turns the empty string you get mid-edit into
 * `min`, so backspacing to clear snapped the box to 1 and typing "20" over it
 * produced "120". The draft string decouples the two — the field shows your
 * keystrokes, the parent only hears about a real number.
 *
 * Committing on blur/Enter rather than per keystroke also stops "20" from
 * firing a request for 2 and then another for 20: both values are URL params
 * that refetch the whole dashboard.
 */
function MonthsInput({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Escape has to blur to leave the field, but blur commits. Setting the draft
  // back first doesn't help — that's a state update, so the commit triggered by
  // the same keystroke still reads the abandoned value. A ref is the only part
  // of this that's readable synchronously.
  const abandonEdit = useRef(false);

  // Follows the committed value when it changes from elsewhere — Clear filters,
  // a back/forward navigation, or the clamp rejecting what was typed.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    if (abandonEdit.current) {
      abandonEdit.current = false;
      setDraft(String(value));
      return;
    }
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      {label}
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${label} in months`}
        value={draft}
        // Digits only. type="number" would report '' for a half-typed entry
        // the browser considers invalid, which is the same hole the draft is
        // here to close.
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            abandonEdit.current = true;
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-16 rounded-full border-0 bg-surface-muted px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue/30"
      />
      {suffix}
    </label>
  );
}

export function ForecastPanel({
  forecast,
  targetMonths,
  trailingMonths,
  onTargetMonthsChange,
  onTrailingMonthsChange,
}: {
  forecast: InvestorsForecast;
  targetMonths: number;
  trailingMonths: number;
  onTargetMonthsChange: (n: number) => void;
  onTrailingMonthsChange: (n: number) => void;
}) {
  const months = forecast.estimatedMonthsRemaining;
  const years = months !== null ? months / 12 : null;

  // How much faster the target is than the current pace — the number that says
  // whether the target is a nudge or a fantasy.
  const speedUp = months !== null && targetMonths > 0 ? months / targetMonths : null;

  return (
    <ChartCard
      title="Completion Forecast"
      description="Projected payoff pace based on recent disbursement activity."
      actions={
        <div className="flex items-center gap-3">
          <MonthsInput
            label="Trailing window"
            suffix="mo"
            value={trailingMonths}
            min={1}
            max={36}
            onChange={onTrailingMonthsChange}
          />
          <MonthsInput
            label="Target"
            suffix="mo"
            value={targetMonths}
            min={1}
            max={120}
            onChange={onTargetMonthsChange}
          />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_0.9fr] lg:items-stretch">
        <div className="grid gap-3 sm:grid-cols-3">
          <ForecastStat
            label="Avg. Monthly Payout"
            value={formatCurrency(forecast.avgMonthlyDisbursement)}
            hint={`Mean of the last ${forecast.trailingMonths} months`}
          />
          <ForecastStat
            label="Still Owed"
            value={formatCurrency(forecast.remainingLiability)}
            hint="Investment not yet repaid"
          />
          <ForecastStat
            label="Months Remaining"
            value={months !== null ? months.toFixed(1) : '—'}
            hint={years !== null ? `About ${years.toFixed(1)} years at this pace` : undefined}
          />
        </div>

        <div aria-hidden className="hidden items-center justify-center text-2xl text-ink-faint lg:flex">
          →
        </div>

        <div
          className="flex flex-col justify-center rounded-2xl border border-white/10 p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #105484 0%, #168670 45%, #218E59 75%, #2C923F 100%)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Expected Completion</p>
          <p className="mt-1.5 font-heading text-[28px] font-semibold leading-none tracking-tight">
            {forecast.expectedCompletionDate ? formatDateWithYear(forecast.expectedCompletionDate) : '—'}
          </p>
          <p className="mt-2 text-[12px] leading-snug text-white/70">
            The date every investor is fully repaid if payouts continue at the current average.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-amber-soft/60 p-4 ring-1 ring-amber/20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            To finish in {forecast.targetMonths} months instead
          </p>
          {speedUp !== null && speedUp > 1 && (
            <p className="text-[11px] text-ink-muted">{speedUp.toFixed(1)}× the current pace</p>
          )}
        </div>
        <p className="mt-1.5 font-heading text-[22px] font-semibold leading-none tracking-tight tabular-nums text-ink">
          {forecast.requiredMonthlyProfitForTarget !== null
            ? formatCurrency(forecast.requiredMonthlyProfitForTarget)
            : '—'}
          <span className="ml-1.5 text-[13px] font-medium text-ink-muted">of profit needed every month</span>
        </p>
      </div>
    </ChartCard>
  );
}
