// Mirrors GET /api/dashboard/investors exactly (verified against
// controllers/investorDashboard.controller.js + services/investorDashboard.service.js
// + services/investorDashboard.filters.js, not guessed).
//
// - Every SQL-aggregated currency/percentage field (kpis, profitByFacility.byFacility,
//   trends, facilityComparison, investors) is a STRING — same NUMERIC-comes-back-as-string
//   gotcha as the bookings dashboard. Run through num() before math/charting.
// - EXCEPTION: profitByFacility.total and every forecast field
//   (avgMonthlyDisbursement, remainingLiability, estimatedMonthsRemaining,
//   requiredMonthlyProfitForTarget) are computed in JS with Number(...), so they
//   arrive as real JSON numbers, not strings.
// - period_month is a DATE column serialized the same timezone-shifted way as the
//   bookings dashboard's date fields — always take apiDate()'s first-10-chars slice.
// - forecast.expectedCompletionDate is already a plain 'YYYY-MM-DD' string (built
//   server-side via toISOString().slice(0,10)), safe to render as-is.
// - kpis.remaining_liability and every pending_amount/completion_pct figure are
//   current-state (all-time) and ignore the date range — only disbursed-amount and
//   the trend-chart rows are windowed by startDate/endDate (see meta.notes.snapshotVsWindowed).

export type InvestorStatus = 'Completed' | 'Partially Disbursed' | 'Pending';

export interface InvestorsDashboardFilters {
  startDate?: string;
  endDate?: string;
  /** csv of facility ids */
  facilityId?: string;
  /** csv of investor ids */
  investorId?: string;
  /** csv of InvestorStatus labels */
  status?: string;
  /** integer, clamped 1-120 server-side */
  targetMonths?: number;
  /** integer, clamped 1-36 server-side */
  trailingMonths?: number;
}

export interface HighestPendingInvestor {
  investor_id: number;
  investor_name: string;
  pending_amount: string;
}

export interface InvestorsKpiComparison {
  startDate: string;
  endDate: string;
  /** the only comparable KPI field here — total_investment/remaining_liability are all-time running balances, not period flows */
  total_amount_disbursed_change_pct: number | null;
}

export interface InvestorsKpis {
  total_investment: string;
  total_amount_disbursed: string;
  disbursed_pct: string | null;
  remaining_liability: string;
  highestPendingInvestor: HighestPendingInvestor | null;
  /** null when the date range is open-ended */
  comparison: InvestorsKpiComparison | null;
}

export interface ProfitByFacilityRow {
  facility_id: number;
  facility_code: string;
  facility_name: string;
  total_profit: string;
  share_pct: number | null;
  total_profit_change_pct: number | null;
}

export interface ProfitByFacility {
  /** JS-computed number, not a string (see header comment) */
  total: number;
  total_change_pct: number | null;
  byFacility: ProfitByFacilityRow[];
}

export interface MonthlyDisbursementRow {
  period_month: string;
  disbursed_amount: string;
}

export interface ProfitVsDisbursementRow {
  period_month: string;
  profit_amount: string;
  disbursed_amount: string;
}

export interface RemainingLiabilityTrendRow {
  period_month: string;
  cumulative_disbursed: string;
  remaining_liability: string;
}

export interface FacilityComparisonRow {
  facility_id: number;
  facility_code: string;
  facility_name: string;
  investment_amount: string;
  profit_amount: string;
  disbursed_amount: string;
  pending_amount: string;
  completion_pct: string | null;
  /** null when the date range is open-ended — investment/pending/completion stay uncompared (all-time balances) */
  disbursed_amount_change_pct: number | null;
  profit_amount_change_pct: number | null;
}

export interface InvestorSummaryRow {
  investor_id: number;
  investor_name: string;
  investment_amount: string;
  disbursed_amount: string;
  pending_amount: string;
  completion_pct: string | null;
  status: InvestorStatus | null;
}

export interface InvestorsForecast {
  /** JS number */
  avgMonthlyDisbursement: number;
  /** JS number */
  remainingLiability: number;
  /** JS number, or null when avgMonthlyDisbursement is 0 */
  estimatedMonthsRemaining: number | null;
  /** plain YYYY-MM-DD, or null when estimatedMonthsRemaining is null */
  expectedCompletionDate: string | null;
  trailingMonths: number;
  targetMonths: number;
  /** JS number, or null when total ownership % in scope is 0 */
  requiredMonthlyProfitForTarget: number | null;
}

export interface InvestorsDashboardMeta {
  filters: {
    startDate: string | null;
    endDate: string | null;
    facilityId: string[] | null;
    investorId: string[] | null;
    status: string[] | null;
    targetMonths: number;
    trailingMonths: number;
  };
  // Sections not listed here respect every filter normally.
  filterObedience: {
    profitByFacility: string;
  };
  notes: Record<string, string>;
}

export interface InvestorsDashboardData {
  meta: InvestorsDashboardMeta;
  kpis: InvestorsKpis;
  profitByFacility: ProfitByFacility;
  trends: {
    monthlyDisbursement: MonthlyDisbursementRow[];
    profitVsDisbursement: ProfitVsDisbursementRow[];
    remainingLiability: RemainingLiabilityTrendRow[];
  };
  facilityComparison: FacilityComparisonRow[];
  investors: InvestorSummaryRow[];
  forecast: InvestorsForecast;
}

export interface InvestorsDashboardResponse {
  success: true;
  data: InvestorsDashboardData;
}
