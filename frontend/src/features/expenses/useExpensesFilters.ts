import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ExpenseGranularity } from '@/lib/types/expensesDashboard';
import { getPresetRange, resolvePreset, type DatePresetKey } from '@/lib/datePresets';

export interface ExpensesFiltersState {
  preset: DatePresetKey;
  startDate: string | null;
  endDate: string | null;
  facilityIds: string[];
  categoryIds: string[];
  subcategoryIds: string[];
  paymentMethodIds: string[];
  accountTypes: string[];
  bankNames: string[];
  granularity: ExpenseGranularity;
}

function parseCsv(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

// Same URL-as-source-of-truth pattern as useBookingsFilters. accountTypes and
// bankNames are string tokens (not numeric ids) — the backend's
// buildTextListClause matches them case-insensitively, same 'null' sentinel
// convention as the id-based filters.
export function useExpensesFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const preset = resolvePreset(searchParams.get('preset'));
  const presetRange = preset !== 'custom' ? getPresetRange(preset) : null;

  const filters: ExpensesFiltersState = useMemo(
    () => ({
      preset,
      startDate: presetRange?.startDate ?? searchParams.get('startDate'),
      endDate: presetRange?.endDate ?? searchParams.get('endDate'),
      facilityIds: parseCsv(searchParams.get('facilityId')),
      categoryIds: parseCsv(searchParams.get('categoryId')),
      subcategoryIds: parseCsv(searchParams.get('subcategoryId')),
      paymentMethodIds: parseCsv(searchParams.get('paymentMethodId')),
      accountTypes: parseCsv(searchParams.get('accountType')),
      bankNames: parseCsv(searchParams.get('sourceBank')),
      granularity: (searchParams.get('granularity') as ExpenseGranularity | null) || 'weekly',
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
  const setCategoryIds = useCallback(
    // changing the top-level category resets any subcategory selection, since
    // subcategories are ANDed with the category rollup and could otherwise
    // silently exclude everything
    (ids: string[]) => update({ categoryId: ids.length ? ids.join(',') : null, subcategoryId: null }),
    [update]
  );
  const setSubcategoryIds = useCallback(
    (ids: string[]) => update({ subcategoryId: ids.length ? ids.join(',') : null }),
    [update]
  );
  const setPaymentMethodIds = useCallback(
    (ids: string[]) => update({ paymentMethodId: ids.length ? ids.join(',') : null }),
    [update]
  );
  const setAccountTypes = useCallback(
    (values: string[]) => update({ accountType: values.length ? values.join(',') : null }),
    [update]
  );
  const setBankNames = useCallback(
    (values: string[]) => update({ sourceBank: values.length ? values.join(',') : null }),
    [update]
  );
  const setGranularity = useCallback((g: ExpenseGranularity) => update({ granularity: g }), [update]);

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
      categoryId: filters.categoryIds.length ? filters.categoryIds.join(',') : undefined,
      subcategoryId: filters.subcategoryIds.length ? filters.subcategoryIds.join(',') : undefined,
      paymentMethodId: filters.paymentMethodIds.length ? filters.paymentMethodIds.join(',') : undefined,
      accountType: filters.accountTypes.length ? filters.accountTypes.join(',') : undefined,
      sourceBank: filters.bankNames.length ? filters.bankNames.join(',') : undefined,
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
    setCategoryIds,
    setSubcategoryIds,
    setPaymentMethodIds,
    setAccountTypes,
    setBankNames,
    setGranularity,
    reset,
  };
}
