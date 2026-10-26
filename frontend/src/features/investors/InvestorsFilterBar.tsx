import { ClearFiltersButton } from '@/components/reporting/ClearFiltersButton';
import { DatePresetPicker } from '@/components/reporting/DatePresetPicker';
import { FilterMultiSelect } from '@/components/reporting/FilterMultiSelect';
import { useFacilities, useInvestors } from '@/features/shared/useLookups';
import { DEFAULT_DATE_PRESET } from '@/lib/datePresets';
import type { InvestorsView } from '@/features/investors/useInvestorsFilters';
import type { useInvestorsFilters } from '@/features/investors/useInvestorsFilters';

const STATUS_OPTIONS = ['Completed', 'Partially Disbursed', 'Pending'];

// Same two labelled groups as the Bookings bar — the date control answers
// "when" and the selects answer "what", and reading them as one flat strip
// forces the eye to re-parse each control to work out which is which.
//
// The Period group is hidden entirely on the Investors tab: every metric there
// (facility comparison, per-investor stakes, the completion forecast) is a
// lifetime position, so a date control would sit there implying it does
// something. Overview keeps it — its KPIs and trend charts are windowed.
export function InvestorsFilterBar({
  controller,
  view,
}: {
  controller: ReturnType<typeof useInvestorsFilters>;
  view: InvestorsView;
}) {
  const facilities = useFacilities();
  const investors = useInvestors();

  const { filters, setPreset, setCustomRange, setFacilityIds, setInvestorIds, setStatuses, reset } = controller;
  const showPeriod = view === 'overview';

  const hasActiveFilters =
    (showPeriod && filters.preset !== DEFAULT_DATE_PRESET) ||
    filters.facilityIds.length > 0 ||
    filters.investorIds.length > 0 ||
    filters.statuses.length > 0;

  return (
    <div className="card-surface relative z-30 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      {showPeriod && (
        <>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Period</span>
            <DatePresetPicker
              preset={filters.preset}
              startDate={filters.startDate}
              endDate={filters.endDate}
              onPresetChange={setPreset}
              onCustomRange={setCustomRange}
            />
          </div>
          <div aria-hidden className="h-6 w-px shrink-0 bg-border" />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Filter</span>
        <FilterMultiSelect
          label="Facilities"
          options={(facilities.data ?? []).map((f) => ({ id: String(f.id), label: f.name }))}
          selected={filters.facilityIds}
          onChange={setFacilityIds}
        />
        <FilterMultiSelect
          label="Investors"
          options={(investors.data ?? []).map((i) => ({ id: String(i.id), label: i.name }))}
          selected={filters.investorIds}
          onChange={setInvestorIds}
        />
        <FilterMultiSelect
          label="Status"
          options={STATUS_OPTIONS.map((s) => ({ id: s, label: s }))}
          selected={filters.statuses}
          onChange={setStatuses}
        />
      </div>

      {hasActiveFilters && <ClearFiltersButton onClick={reset} />}
    </div>
  );
}
