import { ClearFiltersButton } from '@/components/reporting/ClearFiltersButton';
import { DatePresetPicker } from '@/components/reporting/DatePresetPicker';
import { FilterMultiSelect } from '@/components/reporting/FilterMultiSelect';
import { useAccountReferences, useCategories, useFacilities, usePaymentMethods } from '@/features/shared/useLookups';
import type { useExpensesFilters } from '@/features/expenses/useExpensesFilters';
import { DEFAULT_DATE_PRESET } from '@/lib/datePresets';

// Two labelled groups, matching the Investors and Bookings bars: the date
// control answers "when" and the selects answer "what". With six selects
// sitting in one flat strip, the date picker was just another pill in the
// row and the eye had to re-parse each control to work out which was which.
//
// Unlike those two bars this one stacks the groups deliberately instead of
// separating them with a vertical rule. Six selects plus a date picker never
// fit on one line, so the row wrapped anyway and left the vertical divider
// stranded at the end of the first line — the layout read as broken rather
// than as two groups. Fixed rows with a full-width rule and a shared label
// gutter make the same split look intentional at every width.
//
// Granularity (weekly/monthly) is deliberately NOT here — it only affects
// the Expense Trend and Category Share Over Time charts, not the whole
// dashboard, so it lives in each of those ChartCards' own actions slot
// (same reasoning as Bookings' RevenueTab). Keeping it in the global filter
// bar previously meant one control silently drove two different tabs.
// Fixed width so "Period" and "Filter" share one gutter and the controls in
// both rows start on the same x.
const GROUP_LABEL = 'w-11 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-faint';

export function ExpensesFilterBar({ controller }: { controller: ReturnType<typeof useExpensesFilters> }) {
  const facilities = useFacilities();
  const categories = useCategories();
  const paymentMethods = usePaymentMethods();
  const accountReferences = useAccountReferences();

  const {
    filters,
    setPreset,
    setCustomRange,
    setFacilityIds,
    setCategoryIds,
    setSubcategoryIds,
    setPaymentMethodIds,
    setAccountTypes,
    setBankNames,
    reset,
  } = controller;

  const hasActiveFilters =
    filters.preset !== DEFAULT_DATE_PRESET ||
    filters.facilityIds.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.subcategoryIds.length > 0 ||
    filters.paymentMethodIds.length > 0 ||
    filters.accountTypes.length > 0 ||
    filters.bankNames.length > 0;

  const topLevelCategories = (categories.data ?? []).filter((c) => c.parent_category_id === null);
  const subcategories = (categories.data ?? []).filter(
    (c) =>
      c.parent_category_id !== null &&
      (filters.categoryIds.length === 0 || filters.categoryIds.includes(String(c.parent_category_id)))
  );

  return (
    <div className="card-surface relative z-30 flex flex-col gap-2.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={GROUP_LABEL}>Period</span>
        <DatePresetPicker
          preset={filters.preset}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onPresetChange={setPreset}
          onCustomRange={setCustomRange}
        />
      </div>

      <div aria-hidden className="h-px w-full bg-border/70" />

      <div className="flex flex-wrap items-center gap-2.5">
        <span className={GROUP_LABEL}>Filter</span>
        <FilterMultiSelect
          label="Facilities"
          options={(facilities.data ?? []).map((f) => ({ id: String(f.id), label: f.name }))}
          selected={filters.facilityIds}
          onChange={setFacilityIds}
        />
        <FilterMultiSelect
          label="Categories"
          options={topLevelCategories.map((c) => ({ id: String(c.id), label: c.name }))}
          selected={filters.categoryIds}
          onChange={setCategoryIds}
        />
        <FilterMultiSelect
          label="Subcategories"
          options={subcategories.map((c) => ({ id: String(c.id), label: c.name }))}
          selected={filters.subcategoryIds}
          onChange={setSubcategoryIds}
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
        <FilterMultiSelect
          label="Account Type"
          options={[
            ...(accountReferences.data?.accountTypes ?? []).map((t) => ({ id: t, label: t })),
            { id: 'null', label: 'Cash / Unlinked' },
          ]}
          selected={filters.accountTypes}
          onChange={setAccountTypes}
        />
        <FilterMultiSelect
          label="Source Bank"
          options={[
            ...(accountReferences.data?.bankNames ?? []).map((b) => ({ id: b, label: b })),
            { id: 'null', label: 'No bank' },
          ]}
          selected={filters.bankNames}
          onChange={setBankNames}
        />
        {hasActiveFilters && (
          <div className="ml-auto">
            <ClearFiltersButton onClick={reset} />
          </div>
        )}
      </div>
    </div>
  );
}
