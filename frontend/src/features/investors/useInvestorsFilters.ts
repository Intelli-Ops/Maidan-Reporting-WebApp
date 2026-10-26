import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InvestorStatus } from '@/lib/types/investorsDashboard';
import { getPresetRange, resolvePreset, type DatePresetKey } from '@/lib/datePresets';

/** Which tab of the Investors dashboard is showing — the Period control is scoped to Overview. */
export type InvestorsView = 'overview' | 'investors';

export interface InvestorsFiltersState {
  preset: DatePresetKey;
  startDate: string | null;
  endDate: string | null;
  facilityIds: string[];
  investorIds: string[];
  statuses: InvestorStatus[];
  targetMonths: number;
  trailingMonths: number;
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

const DEFAULT_TARGET_MONTHS = 12;
const DEFAULT_TRAILING_MONTHS = 6;

// Same URL-as-source-of-truth pattern as useBookingsFilters — see that file for
// why presets are recomputed from "now" on every read instead of frozen into
// the URL. targetMonths/trailingMonths are forecast-calculator inputs, clamped
// client-side to match the server's 1-120 / 1-36 bounds so the UI never shows
// a value the API would silently reclamp.
export function useInvestorsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const preset = resolvePreset(searchParams.get('preset'));
  const presetRange = preset !== 'custom' ? getPresetRange(preset) : null;

  const filters: InvestorsFiltersState = useMemo(
    () => ({
      preset,
      startDate: presetRange?.startDate ?? searchParams.get('startDate'),
      endDate: presetRange?.endDate ?? searchParams.get('endDate'),
      facilityIds: parseCsv(searchParams.get('facilityId')),
      investorIds: parseCsv(searchParams.get('investorId')),
      statuses: parseCsv(searchParams.get('status')) as InvestorStatus[],
      targetMonths: clamp(parseInt(searchParams.get('targetMonths') ?? '', 10) || DEFAULT_TARGET_MONTHS, 1, 120),
      trailingMonths: clamp(
        parseInt(searchParams.get('trailingMonths') ?? '', 10) || DEFAULT_TRAILING_MONTHS,
        1,
        36
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, preset, presetRange?.startDate, presetRange?.endDate]
  );

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setPreset = useCallback(
    (key: DatePresetKey) => {
      if (key === 'custom') update({ preset: 'custom' });
      else update({ preset: key, startDate: null, endDate: null });
    },
    [update]
  );

  const setCustomRange = useCallback(
    (startDate: string | null, endDate: string | null) => {
      update({ preset: 'custom', startDate, endDate });
    },
    [update]
  );

  const setFacilityIds = useCallback((ids: string[]) => update({ facilityId: ids.length ? ids.join(',') : null }), [update]);
  const setInvestorIds = useCallback((ids: string[]) => update({ investorId: ids.length ? ids.join(',') : null }), [update]);
  const setStatuses = useCallback(
    (statuses: string[]) => update({ status: statuses.length ? statuses.join(',') : null }),
    [update]
  );
  const setTargetMonths = useCallback(
    (n: number) => update({ targetMonths: String(clamp(n, 1, 120)) }),
    [update]
  );
  const setTrailingMonths = useCallback(
    (n: number) => update({ trailingMonths: String(clamp(n, 1, 36)) }),
    [update]
  );

  // Clearing filters must not also clear which TAB you are on. `view` lives in
  // the same query string as the filters, so wiping the whole thing threw the
  // user back to Overview mid-task.
  const reset = useCallback(
    () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams();
          const view = prev.get('view');
          if (view) next.set('view', view);
          return next;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const queryParams = useMemo(
    () => ({
      startDate: filters.startDate ?? undefined,
      endDate: filters.endDate ?? undefined,
      facilityId: filters.facilityIds.length ? filters.facilityIds.join(',') : undefined,
      investorId: filters.investorIds.length ? filters.investorIds.join(',') : undefined,
      status: filters.statuses.length ? filters.statuses.join(',') : undefined,
      targetMonths: filters.targetMonths,
      trailingMonths: filters.trailingMonths,
    }),
    [filters]
  );

  return {
    filters,
    queryParams,
    setPreset,
    setCustomRange,
    setFacilityIds,
    setInvestorIds,
    setStatuses,
    setTargetMonths,
    setTrailingMonths,
    reset,
  };
}
