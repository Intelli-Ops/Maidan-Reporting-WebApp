// Mirrors GET /api/dashboard/expenses exactly (verified against
// controllers/expenseDashboard.controller.js + services/expenseDashboard.service.js
// + services/expenseDashboard.filters.js, not guessed).
//
// - Every SQL-aggregated currency/percentage field is a STRING (Postgres NUMERIC
//   comes back from node-pg as a string) — run through num() before math/charting.
// - EXCEPTION: kpis.delta's deltaAmount/deltaPct are computed in JS with
//   Number(...).toFixed(2) rounds, so they arrive as real JSON numbers (or null
//   for deltaPct when the previous period totalled zero).
// - expenseTrend/categoryShareOverTime `period` and likeForLikeMonth's
//   year/month_number are plain values, not the ISO-datetime-with-timezone-shift
//   pattern the bookings/investors dashboards use for date-typed columns — period
//   comes from date_trunc(...)::date, still worth taking through apiDate() for
//   consistency since it serializes the same way as any other DATE column.
// - accountType/sourceBank filters and the byFacility/categoryShareOverTime
//   filterObedience exceptions are documented in meta.notes/meta.filterObedience
//   and surfaced directly from there, not re-derived client-side.

export type ExpenseGranularity = 'weekly' | 'monthly';

export interface ExpensesDashboardFilters {
  startDate?: string;
  endDate?: string;
  /** csv of facility ids */
  facilityId?: string;
  /** csv of top-level or leaf category ids; rolls up to include children */
  categoryId?: string;
  /** csv of leaf category ids, exact match, ANDed with categoryId */
  subcategoryId?: string;
  /** csv of payment method ids, or literal 'null' sentinel */
  paymentMethodId?: string;
  /** csv of 'Air Field' / 'Maidan Core', or literal 'null' sentinel */
  accountType?: string;
  /** csv of bank names, or literal 'null' sentinel */
  sourceBank?: string;
  granularity?: ExpenseGranularity;
}

export interface ExpensesDelta {
  currentPeriod: { startDate: string; endDate: string; totalAmount: number; totalTransactions: number };
  previousPeriod: { startDate: string; endDate: string; totalAmount: number; totalTransactions: number };
  /** JS number */
  deltaAmount: number;
  /** JS number, or null when the previous period totalled zero */
  deltaPct: number | null;
}

export interface ExpensesTopFacility {
  facilityId: number;
  facilityCode: string;
  facilityName: string;
  totalAmount: string;
}

export interface ExpensesKpiComparison {
  startDate: string;
  endDate: string;
  total_transactions_change_pct: number | null;
  /** percentage-POINT change, not relative % — cash_pct is already a percentage */
  cash_pct_change_pp: number | null;
  non_cash_pct_change_pp: number | null;
}

export interface ExpensesKpis {
  total_transactions: number;
  total_expense_amount: string;
  cash_amount: string;
  non_cash_amount: string;
  cash_pct: string | null;
  non_cash_pct: string | null;
  topFacility: ExpensesTopFacility | null;
  delta: ExpensesDelta;
  /** separate from `delta` above (which already covers total_expense_amount) — null when the date range is open-ended */
  comparison: ExpensesKpiComparison | null;
}

export interface ExpenseByFacilityRow {
  facility_id: number;
  facility_code: string;
  facility_name: string;
  expense_count: number;
  total_amount: string;
  share_pct: string | null;
  total_amount_change_pct: number | null;
}

export interface ExpenseTrendRow {
  period: string;
  expense_count: number;
  total_amount: string;
}

export interface ExpenseByPaymentMethodRow {
  payment_method_id: number; // 0 = synthetic "Unspecified" bucket
  payment_method_name: string;
  expense_count: number;
  total_amount: string;
  total_amount_change_pct: number | null;
}

export interface ExpenseByCategoryRow {
  top_category_id: number;
  category_name: string;
  expense_count: number;
  total_amount: string;
  share_pct: string | null;
  total_amount_change_pct: number | null;
}

export interface CategoryShareOverTimeRow {
  period: string;
  top_category_id: number;
  category_name: string;
  expense_count: number;
  total_amount: string;
  share_pct: string | null;
}

export interface LikeForLikeMonthRow {
  year: number;
  month_number: number;
  month_name: string;
  expense_count: number;
  total_amount: string;
}

export interface ExpensesDashboardMeta {
  filters: {
    startDate: string | null;
    endDate: string | null;
    facilityId: string[] | null;
    categoryId: string[] | null;
    subcategoryId: string[] | null;
    paymentMethodId: string[] | null;
    accountType: string[] | null;
    sourceBank: string[] | null;
    granularity: ExpenseGranularity;
  };
  // Sections not listed here respect every filter normally.
  filterObedience: {
    byFacility: string;
    categoryShareOverTime: string;
  };
  notes: Record<string, string>;
}

export interface ExpensesDashboardData {
  meta: ExpensesDashboardMeta;
  kpis: ExpensesKpis;
  byFacility: ExpenseByFacilityRow[];
  expenseTrend: { granularity: ExpenseGranularity; rows: ExpenseTrendRow[] };
  byPaymentMethod: ExpenseByPaymentMethodRow[];
  byCategory: ExpenseByCategoryRow[];
  categoryShareOverTime: { granularity: ExpenseGranularity; rows: CategoryShareOverTimeRow[] };
  likeForLikeMonth: LikeForLikeMonthRow[];
}

export interface ExpensesDashboardResponse {
  success: true;
  data: ExpensesDashboardData;
}
