// Mirrors GET /api/dashboard/bookings exactly (verified against
// controllers/dashboard.controller.js + services/dashboard.service.js +
// services/dashboard.filters.js, not guessed). A few things that look like
// bugs below are real backend behavior, documented inline where they'd
// otherwise be surprising:
//
// - Every currency/percentage field is a STRING. Postgres NUMERIC columns
//   come back from node-postgres as strings (precision safety), and no
//   custom type parser is registered. Always run these through num()/pct()
//   from lib/format.ts before doing math or charting.
// - Date-shaped fields are ISO datetime strings with a timezone footgun:
//   they're Postgres DATE columns serialized via JS Date -> toISOString(),
//   which can shift the calendar day depending on server TZ. Always take
//   just the first 10 chars (YYYY-MM-DD) rather than re-parsing with `new
//   Date(...)` a second time.

export type Granularity = 'daily' | 'weekly' | 'monthly';

export interface BookingsDashboardFilters {
  startDate?: string;
  endDate?: string;
  /** csv of facility ids */
  facilityId?: string;
  /** csv of sport type ids */
  sportTypeId?: string;
  /** csv of payment method ids, or the literal 'null' sentinel for "no payment method recorded" */
  paymentMethodId?: string;
  granularity?: Granularity;
  binLimit?: number;
}

export interface BookingsKpiComparison {
  startDate: string;
  endDate: string;
  total_bookings_change_pct: number | null;
  total_net_revenue_change_pct: number | null;
  total_gross_amount_change_pct: number | null;
  total_discount_amount_change_pct: number | null;
  cancellation_rate_change_pct: number | null;
}

export interface BookingsKpis {
  total_bookings: number;
  cancelled_bookings: number;
  cancellation_rate_pct: string;
  total_net_revenue: string;
  total_gross_amount: string;
  total_discount_amount: string;
  total_hours: string;
  /** vs the immediately preceding period of equal length; null if the date range is open-ended. */
  comparison: BookingsKpiComparison | null;
}

export interface RevenueTrendRow {
  period: string;
  booking_count: number;
  net_revenue: string;
  discount_amount: string;
}

export interface RevenueHeatmapCell {
  booking_date: string;
  iso_weekday: number; // 1=Mon .. 7=Sun
  booking_count: number;
  net_revenue: string;
}

export interface FacilityBreakdownRow {
  facility_id: number;
  facility_code: string;
  facility_name: string;
  booking_count: number;
  net_revenue: string;
  gross_amount: string;
  gross_share_pct: string | null;
  /** vs the immediately preceding period of equal length; null if unavailable. */
  net_revenue_change_pct: number | null;
}

export interface FacilityShareOverTimeRow {
  week_start: string;
  facility_id: number;
  facility_code: string;
  facility_name: string;
  booking_count: number;
  net_revenue: string;
  revenue_share_pct: string | null;
}

export interface DiscountBurdenRow {
  facility_id: number;
  facility_code: string;
  facility_name: string;
  total_discount_amount: string;
  total_gross_amount: string;
  discount_burden_pct: string;
  /** Percentage-POINT change (not relative %) vs the preceding period of equal length; null if unavailable. */
  discount_burden_pct_change_pp: number | null;
}

export interface BankVsMaidanDiscountShare {
  bookings_with_bin: number;
  total_discount_amount: string;
  bank_absorbed_amount: string;
  maidan_absorbed_amount: string;
}

export interface UnderusedBinRow {
  bin_number: string;
  bank_name: string;
  /** Raw bank-supplied free text. Prefer card_label for display. */
  card_type: string | null;
  discount_pct: string | null;
  discount_cap: string | null;
  usage_count: number;
  /** vs this same BIN's usage in the immediately preceding period of equal length; null if unavailable. */
  usage_count_change_pct: number | null;

  // --- derived server-side in services/cardType.js ---
  /** Ladder position: Infinite | World Elite | Signature | Platinum | ... | Standard. Null if unparseable. */
  tier: string | null;
  /** 1 = most premium (Infinite). Ordered, not categorical — never colour this as a rainbow. */
  tier_rank: number | null;
  network: string | null;
  funding: string | null;
  /** Display string, e.g. "Visa · Infinite · Debit"; falls back to raw card_type when nothing parses. */
  card_label: string;

  /** Top discount_pct quartile across ALL BINs. The payload includes non-high-value rows too, for search. */
  is_high_value: boolean;
  /**
   * What the card is actually worth per booking. Measured AVG(gross - net)
   * where the BIN was used in period, modelled from discount_pct x period avg
   * gross (capped) where it wasn't — discount_cap alone wildly overstates it.
   */
  avg_saving: string | null;
  /** false = avg_saving is modelled rather than observed (always the case at usage_count 0). */
  saving_is_measured: boolean;
}

export interface UnderusedHighValueBins {
  /** How many rows to show before "show all" — a display hint; rows always holds every BIN. */
  binLimit: number;
  /** Count of is_high_value rows, for the "showing N of M" line. */
  highValueCount: number;
  /** EVERY BIN in the reference table, high-value first then ascending usage. Includes zero-usage rows. */
  rows: UnderusedBinRow[];
}

export interface SportBreakdownRow {
  sport_type_id: number;
  sport_name: string;
  booking_count: number;
  net_revenue: string;
  revenue_share_pct: string | null;
  /** vs the immediately preceding period of equal length; null if unavailable. */
  net_revenue_change_pct: number | null;
}

/** One weekday's totals over a single window. */
export interface WeekdayWindow {
  booking_count: number;
  /**
   * How many times this weekday fell inside the window's CALENDAR range —
   * not how many weeks the window spans, and not how many of those days had
   * bookings. This is the denominator behind avg_per_occurrence.
   */
  occurrences: number;
  net_revenue: string;
  /** net_revenue / occurrences; null when the weekday never occurred in the window. */
  avg_per_occurrence: string | null;
}

export interface LikeForLikeWeekday {
  iso_weekday: number; // 1=Mon .. 7=Sun
  weekday_label: string;
  current: WeekdayWindow;
  /** null when the range is open-ended and has no comparable preceding window. */
  previous: WeekdayWindow | null;
  /**
   * Change in avg_per_occurrence, current vs previous. Compared per-occurrence
   * rather than on totals because the two equal-length windows rarely contain
   * the same number of Fridays.
   */
  change_pct: number | null;
}

/** Raw (ISO week start x ISO weekday) grid — drives the per-weekday sparkline. */
export interface LikeForLikeDayRow {
  week_start: string;
  iso_weekday: number;
  weekday_label: string;
  booking_count: number;
  net_revenue: string;
}

export interface LikeForLikeDay {
  /** The preceding window the comparison is against; null if the range is open-ended. */
  comparison: { startDate: string; endDate: string } | null;
  /** Always 7 entries, Monday-first, regardless of whether the weekday had bookings. */
  weekdays: LikeForLikeWeekday[];
  byWeek: LikeForLikeDayRow[];
}

export interface PaymentMethodBreakdownRow {
  payment_method_id: number; // 0 = synthetic "Unspecified" bucket
  payment_method_name: string;
  booking_count: number;
  net_revenue: string;
  /** vs the immediately preceding period of equal length; null if unavailable. */
  net_revenue_change_pct: number | null;
}

/**
 * One (hour-of-day x status) cell. `slot_start_hour` is the hour the slot
 * STARTS (0-23), denormalised server-side from the free-text time slot, and
 * is null for bookings whose slot text could not be parsed — roughly 15% of
 * rows, kept as a real "Unknown" bucket so slot totals still reconcile with
 * the Total Bookings KPI rather than quietly falling short of it.
 */
export interface TimeSlotRow {
  slot_start_hour: number | null;
  status: string;
  booking_count: number;
  net_revenue: string;
  total_hours: string;
}

export interface ByTimeSlot {
  /** The preceding window of equal length; null when the range is open-ended. */
  comparison: { startDate: string; endDate: string } | null;
  /**
   * Every status present in either window, busiest first. Status is free text
   * normalised at import, not a fixed enum — read the set from here rather
   * than hard-coding it. Shared across both windows so legend and stacking
   * order stay put when a rare status appears in only one of them.
   */
  statuses: string[];
  current: TimeSlotRow[];
  /** Same shape over the preceding window; null when there is none. */
  previous: TimeSlotRow[] | null;
}

export interface BookingsDashboardMeta {
  filters: {
    startDate: string | null;
    endDate: string | null;
    facilityId: string[] | null;
    sportTypeId: string[] | null;
    paymentMethodId: string[] | null;
    granularity: Granularity;
  };
  // Sections not listed here respect every filter normally.
  filterObedience: {
    byFacility: string;
    facilityShareOverTime: string;
    discountBurdenByFacility: string;
    bySport: string;
  };
  notes: Record<string, string>;
}

export interface BookingsDashboardData {
  meta: BookingsDashboardMeta;
  kpis: BookingsKpis;
  revenueTrend: { granularity: Granularity; rows: RevenueTrendRow[] };
  revenueHeatmap: RevenueHeatmapCell[];
  byFacility: FacilityBreakdownRow[];
  facilityShareOverTime: FacilityShareOverTimeRow[];
  discountBurdenByFacility: DiscountBurdenRow[];
  bankVsMaidanDiscountShare: BankVsMaidanDiscountShare;
  underusedHighValueBins: UnderusedHighValueBins;
  bySport: SportBreakdownRow[];
  likeForLikeDay: LikeForLikeDay;
  byPaymentMethod: PaymentMethodBreakdownRow[];
  byTimeSlot: ByTimeSlot;
}

export interface BookingsDashboardResponse {
  success: true;
  data: BookingsDashboardData;
}
