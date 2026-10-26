import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Granularity } from '@/lib/types/bookingsDashboard';
import { getPresetRange, resolvePreset, type DatePresetKey } from '@/lib/datePresets';

export interface BookingsFiltersState {
  preset: DatePresetKey;
  startDate: string | null;
  endDate: string | null;
  facilityIds: string[];
  sportTypeIds: string[];
  paymentMethodIds: string[];
  granularity: Granularity;
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

// Filter state lives entirely in the URL (search params), not component
// state — makes dashboard views shareable/bookmarkable and doubles as the
// React Query cache key. Presets (e.g. "3 months") are recomputed from
// "now" on every read rather than frozen into the URL, so a bookmarked
// preset link always means "the last three complete months," not whatever
// months they were when bookmarked — only 'custom' freezes explicit dates
// into the URL. All three dashboards share this preset set; see datePresets.
export function useBookingsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const preset = resolvePreset(searchParams.get('preset'));
  const presetRange = preset !== 'custom' ? getPresetRange(preset) : null;

  const filters: BookingsFiltersState = useMemo(
    () => ({
      preset,
      startDate: presetRange?.startDate ?? searchParams.get('startDate'),
      endDate: presetRange?.endDate ?? searchParams.get('endDate'),
      facilityIds: parseCsv(searchParams.get('facilityId')),
      sportTypeIds: parseCsv(searchParams.get('sportTypeId')),
      paymentMethodIds: parseCsv(searchParams.get('paymentMethodId')),
      granularity: (searchParams.get('granularity') as Granularity | null) || 'daily',
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

  const setFacilityIds = useCallback(
    (ids: string[]) => update({ facilityId: ids.length ? ids.join(',') : null }),
    [update]
  );
  const setSportTypeIds = useCallback(
    (ids: string[]) => update({ sportTypeId: ids.length ? ids.join(',') : null }),
    [update]
  );
  const setPaymentMethodIds = useCallback(
    (ids: string[]) => update({ paymentMethodId: ids.length ? ids.join(',') : null }),
    [update]
  );
  const setGranularity = useCallback((g: Granularity) => update({ granularity: g }), [update]);

  // Preserves `view`: the tab lives in the same query string as the filters,
  // so clearing filters would otherwise also send the user back to tab one.
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
      sportTypeId: filters.sportTypeIds.length ? filters.sportTypeIds.join(',') : undefined,
      paymentMethodId: filters.paymentMethodIds.length ? filters.paymentMethodIds.join(',') : undefined,
      granularity: filters.granularity,
    }),
    [filters]
  );

  return {
    filters,
    queryParams,
    setPreset,
    setCustomRange,
    setFacilityIds,
    setSportTypeIds,
    setPaymentMethodIds,
    setGranularity,
    reset,
  };
}
