import { ClearFiltersButton } from '@/components/reporting/ClearFiltersButton';
import { DatePresetPicker } from '@/components/reporting/DatePresetPicker';
import { FilterMultiSelect } from '@/components/reporting/FilterMultiSelect';
import { useFacilities, usePaymentMethods, useSportTypes } from '@/features/shared/useLookups';
import { DATE_PRESETS, DEFAULT_DATE_PRESET, validateBookingsRange, type BookingsView } from '@/lib/datePresets';
import type { useBookingsFilters } from '@/features/bookings/useBookingsFilters';

export function BookingsFilterBar({
  controller,
  view,
}: {
  controller: ReturnType<typeof useBookingsFilters>;
  /** Custom-range limits differ per tab — see BOOKINGS_RANGE_LIMITS. */
  view: BookingsView;
}) {
  const facilities = useFacilities();
  const sports = useSportTypes();
  const paymentMethods = usePaymentMethods();

  const { filters, setPreset, setCustomRange, setFacilityIds, setSportTypeIds, setPaymentMethodIds, reset } =
    controller;

  const hasActiveFilters =
    filters.preset !== DEFAULT_DATE_PRESET ||
    filters.facilityIds.length > 0 ||
    filters.sportTypeIds.length > 0 ||
    filters.paymentMethodIds.length > 0;

  // Two labelled groups rather than one undifferentiated row of pills. The
  // date control answers "when" and the three selects answer "what" — reading
  // them as one flat strip forced the eye to re-parse each control to work out
  // which was which. Every control is pinned to h-9 so their centres line up
  // on a single baseline instead of drifting by a pixel or two each.
  return (
    <div className="card-surface relative z-30 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Period</span>
        <DatePresetPicker
          preset={filters.preset}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onPresetChange={setPreset}
          onCustomRange={setCustomRange}
          presets={DATE_PRESETS}
          validateRange={(s, e) => validateBookingsRange(s, e, view)}
        />
      </div>

      <div aria-hidden className="h-6 w-px shrink-0 bg-border" />

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Filter</span>
        <FilterMultiSelect
          label="Facilities"
          options={(facilities.data ?? []).map((f) => ({ id: String(f.id), label: f.name }))}
          selected={filters.facilityIds}
          onChange={setFacilityIds}
        />
        <FilterMultiSelect
          label="Sports"
          options={(sports.data ?? []).map((s) => ({ id: String(s.id), label: s.name }))}
          selected={filters.sportTypeIds}
          onChange={setSportTypeIds}
        />
        <FilterMultiSelect
          label="Payment Methods"
          options={[
            ...(paymentMethods.data ?? []).map((p) => ({ id: String(p.id), label: p.name })),
            { id: 'null', label: 'Unspecified' },
          ]}
          selected={filters.paymentMethodIds}
          onChange={setPaymentMethodIds}
        />
      </div>

      {hasActiveFilters && <ClearFiltersButton onClick={reset} />}
    </div>
  );
}
