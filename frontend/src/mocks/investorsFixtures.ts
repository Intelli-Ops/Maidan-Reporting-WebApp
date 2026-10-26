import { MOCK_FACILITIES } from '@/mocks/bookingsFixtures';
import { mulberry32, seedFor, monthsBack, toApiDatetime, toDateStr } from '@/mocks/mockRandom';
import type {
  FacilityComparisonRow,
  HighestPendingInvestor,
  InvestorSummaryRow,
  InvestorStatus,
  InvestorsDashboardData,
  InvestorsForecast,
  MonthlyDisbursementRow,
  ProfitByFacility,
  ProfitByFacilityRow,
  ProfitVsDisbursementRow,
  RemainingLiabilityTrendRow,
} from '@/lib/types/investorsDashboard';

export const MOCK_INVESTORS = [
  { investor_id: 1, investor_name: 'Bilal Sheikh', contact_info: 'bilal.sheikh@example.com' },
  { investor_id: 2, investor_name: 'Ayesha Raza', contact_info: 'ayesha.raza@example.com' },
  { investor_id: 3, investor_name: 'Kamran Malik', contact_info: null as string | null },
  { investor_id: 4, investor_name: 'Zoya Farooq', contact_info: 'zoya.farooq@example.com' },
];

interface Stake {
  facility_investor_id: number;
  facility_id: number;
  investor_id: number;
  investment_amount: number;
  /** fraction 0-1, matches the real ownership_percentage NUMERIC(6,4) column */
  ownership_percentage: number;
  /** fraction of investment_amount disbursed per active month; 0 = stake hasn't started disbursing yet (Pending) */
  monthlyRate: number;
}

// A deliberate spread of pace/status so the Status filter and forecast panel
// have something real to demonstrate: stake 4 finishes early (near/at
// Completed), stake 6 has zero disbursements (Pending), the rest land
// somewhere in between (Partially Disbursed).
const STAKES: Stake[] = [
  { facility_investor_id: 1, facility_id: 1, investor_id: 1, investment_amount: 5_000_000, ownership_percentage: 0.25, monthlyRate: 0.09 },
  { facility_investor_id: 2, facility_id: 1, investor_id: 2, investment_amount: 3_000_000, ownership_percentage: 0.15, monthlyRate: 0.05 },
  { facility_investor_id: 3, facility_id: 2, investor_id: 1, investment_amount: 4_000_000, ownership_percentage: 0.3, monthlyRate: 0.07 },
  { facility_investor_id: 4, facility_id: 2, investor_id: 3, investment_amount: 6_000_000, ownership_percentage: 0.45, monthlyRate: 0.16 },
  { facility_investor_id: 5, facility_id: 3, investor_id: 4, investment_amount: 2_500_000, ownership_percentage: 0.5, monthlyRate: 0.08 },
  { facility_investor_id: 6, facility_id: 3, investor_id: 2, investment_amount: 1_500_000, ownership_percentage: 0.3, monthlyRate: 0 },
];

const FACILITY_PROFIT_BASE: Record<number, number> = { 1: 2_200_000, 2: 2_800_000, 3: 1_400_000 };

const HISTORY_MONTHS = 18;

interface DisbursementRow {
  facility_investor_id: number;
  period_month: string;
  disbursed_amount: number;
}

function generateDisbursements(): DisbursementRow[] {
  const months = monthsBack(HISTORY_MONTHS);
  const rows: DisbursementRow[] = [];
  for (const stake of STAKES) {
    if (stake.monthlyRate <= 0) continue;
    let remaining = stake.investment_amount;
    for (const month of months) {
      if (remaining <= 0) break;
      const rand = mulberry32(seedFor(stake.facility_investor_id, month));
      const jitter = 0.7 + rand() * 0.6;
      const amount = Math.min(remaining, stake.investment_amount * stake.monthlyRate * jitter);
      if (amount <= 0) continue;
      rows.push({ facility_investor_id: stake.facility_investor_id, period_month: month, disbursed_amount: amount });
      remaining -= amount;
    }
  }
  return rows;
}

interface ProfitRow {
  facility_id: number;
  period_month: string;
  profit_amount: number;
}

function generateMonthlyProfit(): ProfitRow[] {
  const months = monthsBack(HISTORY_MONTHS);
  const rows: ProfitRow[] = [];
  for (const facility of MOCK_FACILITIES) {
    const base = FACILITY_PROFIT_BASE[facility.facility_id] ?? 1_800_000;
    for (const month of months) {
      const rand = mulberry32(seedFor('profit', facility.facility_id, month));
      const jitter = 0.75 + rand() * 0.5;
      rows.push({ facility_id: facility.facility_id, period_month: month, profit_amount: base * jitter });
    }
  }
  return rows;
}

function money(n: number): string {
  return n.toFixed(2);
}

// Deterministic pseudo "vs previous period" movement — mirrors the shape of
// the real backend's comparison blocks (see investorDashboard.service.js)
// without needing a second synthetic fi_scope pass.
function changePctFor(...parts: (string | number)[]): number {
  const raw = ((Math.abs(seedFor(...parts, 'chg')) % 400) - 200) / 10; // -20.0 .. +20.0
  return Math.round(raw * 10) / 10;
}

function deriveStatus(investment: number, disbursed: number): InvestorStatus | null {
  if (investment <= 0) return null;
  if (disbursed >= investment) return 'Completed';
  if (disbursed <= 0) return 'Pending';
  return 'Partially Disbursed';
}

export interface InvestorsMockQuery {
  startDate?: string;
  endDate?: string;
  facilityIds: string[];
  investorIds: string[];
  statuses: string[];
  targetMonths: number;
  trailingMonths: number;
}

// Mirrors services/investorDashboard.service.js section-by-section: the
// fi_scope CTE (facility/investor/status filtered, all-time + in-range
// disbursed totals, derived status) is built once and every downstream
// section reads from it exactly like the real SQL does, respecting the same
// filter-obedience exceptions (profitByFacility ignores investor/status;
// facilityComparison always lists every facility).
export function buildInvestorsDashboardMock(query: InvestorsMockQuery): InvestorsDashboardData {
  const disbursements = generateDisbursements();
  const monthlyProfit = generateMonthlyProfit();

  const facilityFilter = new Set(query.facilityIds.filter((id) => id !== 'null').map(Number));
  const investorFilter = new Set(query.investorIds.filter((id) => id !== 'null').map(Number));
  const statusFilter = new Set(query.statuses as InvestorStatus[]);

  const inRange = (month: string) =>
    (!query.startDate || month >= query.startDate) && (!query.endDate || month <= query.endDate);

  const disbByStake = new Map<number, DisbursementRow[]>();
  for (const d of disbursements) {
    const arr = disbByStake.get(d.facility_investor_id) ?? [];
    arr.push(d);
    disbByStake.set(d.facility_investor_id, arr);
  }

  const fiScope = STAKES.filter((s) => facilityFilter.size === 0 || facilityFilter.has(s.facility_id))
    .filter((s) => investorFilter.size === 0 || investorFilter.has(s.investor_id))
    .map((s) => {
      const rows = disbByStake.get(s.facility_investor_id) ?? [];
      const disbursed_all_time = rows.reduce((sum, r) => sum + r.disbursed_amount, 0);
      const disbursed_in_range = rows.filter((r) => inRange(r.period_month)).reduce((sum, r) => sum + r.disbursed_amount, 0);
      const pending_amount = s.investment_amount - disbursed_all_time;
      const status = deriveStatus(s.investment_amount, disbursed_all_time);
      return { ...s, disbursed_all_time, disbursed_in_range, pending_amount, status };
    })
    .filter((s) => statusFilter.size === 0 || (s.status !== null && statusFilter.has(s.status)));

  // --- kpis ---
  const total_investment = fiScope.reduce((sum, s) => sum + s.investment_amount, 0);
  const total_amount_disbursed = fiScope.reduce((sum, s) => sum + s.disbursed_in_range, 0);
  const remaining_liability = fiScope.reduce((sum, s) => sum + s.pending_amount, 0);
  const disbursed_pct = total_investment > 0 ? ((total_amount_disbursed / total_investment) * 100).toFixed(2) : null;

  const pendingByInvestor = new Map<number, number>();
  for (const s of fiScope) pendingByInvestor.set(s.investor_id, (pendingByInvestor.get(s.investor_id) ?? 0) + s.pending_amount);
  let highestPendingInvestor: HighestPendingInvestor | null = null;
  for (const [investor_id, pending_amount] of pendingByInvestor) {
    if (!highestPendingInvestor || pending_amount > Number(highestPendingInvestor.pending_amount)) {
      const inv = MOCK_INVESTORS.find((i) => i.investor_id === investor_id)!;
      highestPendingInvestor = { investor_id, investor_name: inv.investor_name, pending_amount: money(pending_amount) };
    }
  }

  // --- profitByFacility (ignores investorId/status — facility + date range only) ---
  const profitRowsInScope = monthlyProfit.filter(
    (p) => (facilityFilter.size === 0 || facilityFilter.has(p.facility_id)) && inRange(p.period_month)
  );
  const profitByFacilityMap = new Map<number, number>();
  for (const p of profitRowsInScope) profitByFacilityMap.set(p.facility_id, (profitByFacilityMap.get(p.facility_id) ?? 0) + p.profit_amount);
  const hasRange = Boolean(query.startDate && query.endDate);
  const profitByFacilityTotal = [...profitByFacilityMap.values()].reduce((sum, v) => sum + v, 0);
  const profitByFacilityRows: ProfitByFacilityRow[] = MOCK_FACILITIES.map((f) => {
    const facilityProfit = profitByFacilityMap.get(f.facility_id) ?? 0;
    return {
      facility_id: f.facility_id,
      facility_code: f.facility_code,
      facility_name: f.facility_name,
      total_profit: money(facilityProfit),
      share_pct: profitByFacilityTotal > 0 ? Number(((facilityProfit / profitByFacilityTotal) * 100).toFixed(2)) : null,
      total_profit_change_pct: hasRange ? changePctFor(query.startDate!, query.endDate!, 'profit', f.facility_id) : null,
    };
  });
  const profitByFacility: ProfitByFacility = {
    total: Number(profitByFacilityRows.reduce((sum, r) => sum + Number(r.total_profit), 0).toFixed(2)),
    total_change_pct: hasRange ? changePctFor(query.startDate!, query.endDate!, 'profit-total') : null,
    byFacility: profitByFacilityRows,
  };

  // --- monthlyDisbursementTrend (full fi_scope, windowed by date range) ---
  const scopedStakeIds = new Set(fiScope.map((s) => s.facility_investor_id));
  const disbInScopeAndRange = disbursements.filter((d) => scopedStakeIds.has(d.facility_investor_id) && inRange(d.period_month));
  const monthlyDisbMap = new Map<string, number>();
  for (const d of disbInScopeAndRange) monthlyDisbMap.set(d.period_month, (monthlyDisbMap.get(d.period_month) ?? 0) + d.disbursed_amount);
  const monthlyDisbursement: MonthlyDisbursementRow[] = [...monthlyDisbMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period_month, disbursed_amount]) => ({ period_month: toApiDatetime(period_month), disbursed_amount: money(disbursed_amount) }));

  // --- profitVsDisbursementTrend (profit: facility+date only; disbursement: full fi_scope) ---
  const profitByMonth = new Map<string, number>();
  for (const p of profitRowsInScope) profitByMonth.set(p.period_month, (profitByMonth.get(p.period_month) ?? 0) + p.profit_amount);
  const allMonths = new Set([...profitByMonth.keys(), ...monthlyDisbMap.keys()]);
  const profitVsDisbursement: ProfitVsDisbursementRow[] = [...allMonths]
    .sort((a, b) => a.localeCompare(b))
    .map((period_month) => ({
      period_month: toApiDatetime(period_month),
      profit_amount: money(profitByMonth.get(period_month) ?? 0),
      disbursed_amount: money(monthlyDisbMap.get(period_month) ?? 0),
    }));

  // --- remainingLiabilityTrend (cumulative over FULL history, unrestricted by date; display rows windowed) ---
  const allDisbInScope = disbursements.filter((d) => scopedStakeIds.has(d.facility_investor_id));
  const monthlyAllMap = new Map<string, number>();
  for (const d of allDisbInScope) monthlyAllMap.set(d.period_month, (monthlyAllMap.get(d.period_month) ?? 0) + d.disbursed_amount);
  const sortedMonths = [...monthlyAllMap.keys()].sort();
  let cumulative = 0;
  const cumulativeByMonth = new Map<string, number>();
  for (const m of sortedMonths) {
    cumulative += monthlyAllMap.get(m)!;
    cumulativeByMonth.set(m, cumulative);
  }
  const remainingLiabilityTrend: RemainingLiabilityTrendRow[] = sortedMonths
    .filter((m) => inRange(m))
    .map((m) => ({
      period_month: toApiDatetime(m),
      cumulative_disbursed: money(cumulativeByMonth.get(m)!),
      remaining_liability: money(total_investment - cumulativeByMonth.get(m)!),
    }));

  // --- facilityComparison (always all facilities) ---
  const aggByFacility = new Map<number, { investment: number; disbursed: number; pending: number }>();
  for (const s of fiScope) {
    const b = aggByFacility.get(s.facility_id) ?? { investment: 0, disbursed: 0, pending: 0 };
    b.investment += s.investment_amount;
    b.disbursed += s.disbursed_in_range;
    b.pending += s.pending_amount;
    aggByFacility.set(s.facility_id, b);
  }
  const facilityComparison: FacilityComparisonRow[] = MOCK_FACILITIES.map((f) => {
    const agg = aggByFacility.get(f.facility_id) ?? { investment: 0, disbursed: 0, pending: 0 };
    const profit = profitByFacilityMap.get(f.facility_id) ?? 0;
    return {
      facility_id: f.facility_id,
      facility_code: f.facility_code,
      facility_name: f.facility_name,
      investment_amount: money(agg.investment),
      profit_amount: money(profit),
      disbursed_amount: money(agg.disbursed),
      pending_amount: money(agg.pending),
      completion_pct: agg.investment > 0 ? ((agg.disbursed / agg.investment) * 100).toFixed(2) : null,
      disbursed_amount_change_pct: hasRange ? changePctFor(query.startDate!, query.endDate!, 'disbursed', f.facility_id) : null,
      profit_amount_change_pct: hasRange ? changePctFor(query.startDate!, query.endDate!, 'profit-row', f.facility_id) : null,
    };
  });

  // --- investors (grouped from fi_scope; status recomputed on combined totals) ---
  const investorAgg = new Map<number, { investment: number; disbursedAllTime: number; pending: number }>();
  for (const s of fiScope) {
    const b = investorAgg.get(s.investor_id) ?? { investment: 0, disbursedAllTime: 0, pending: 0 };
    b.investment += s.investment_amount;
    b.disbursedAllTime += s.disbursed_all_time;
    b.pending += s.pending_amount;
    investorAgg.set(s.investor_id, b);
  }
  const investors: InvestorSummaryRow[] = [...investorAgg.entries()]
    .map(([investor_id, agg]) => {
      const inv = MOCK_INVESTORS.find((i) => i.investor_id === investor_id)!;
      return {
        investor_id,
        investor_name: inv.investor_name,
        investment_amount: money(agg.investment),
        disbursed_amount: money(agg.disbursedAllTime),
        pending_amount: money(agg.pending),
        completion_pct: agg.investment > 0 ? ((agg.disbursedAllTime / agg.investment) * 100).toFixed(2) : null,
        status: deriveStatus(agg.investment, agg.disbursedAllTime),
      };
    })
    .sort((a, b) => Number(b.pending_amount) - Number(a.pending_amount));

  // --- forecast ---
  const trailingWindow = [...sortedMonths].sort((a, b) => b.localeCompare(a)).slice(0, query.trailingMonths);
  const avgMonthlyDisbursement = trailingWindow.length
    ? trailingWindow.reduce((sum, m) => sum + monthlyAllMap.get(m)!, 0) / trailingWindow.length
    : 0;
  const remainingLiabilityForForecast = fiScope.reduce((sum, s) => sum + s.pending_amount, 0);
  const totalOwnershipPct = fiScope.reduce((sum, s) => sum + s.ownership_percentage, 0);

  const estimatedMonthsRemaining =
    avgMonthlyDisbursement > 0 ? Number((remainingLiabilityForForecast / avgMonthlyDisbursement).toFixed(2)) : null;
  let expectedCompletionDate: string | null = null;
  if (estimatedMonthsRemaining !== null) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.ceil(estimatedMonthsRemaining));
    expectedCompletionDate = toDateStr(d);
  }
  const requiredMonthlyProfitForTarget =
    totalOwnershipPct > 0
      ? Number((remainingLiabilityForForecast / query.targetMonths / totalOwnershipPct).toFixed(2))
      : null;

  const forecast: InvestorsForecast = {
    avgMonthlyDisbursement: Number(avgMonthlyDisbursement.toFixed(2)),
    remainingLiability: Number(remainingLiabilityForForecast.toFixed(2)),
    estimatedMonthsRemaining,
    expectedCompletionDate,
    trailingMonths: query.trailingMonths,
    targetMonths: query.targetMonths,
    requiredMonthlyProfitForTarget,
  };

  return {
    meta: {
      filters: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        facilityId: query.facilityIds.length ? query.facilityIds : null,
        investorId: query.investorIds.length ? query.investorIds : null,
        status: query.statuses.length ? query.statuses : null,
        targetMonths: query.targetMonths,
        trailingMonths: query.trailingMonths,
      },
      filterObedience: {
        profitByFacility:
          'ignores investorId and status — profit is a facility-level pool, not owned by a specific investor',
      },
      notes: {
        status:
          "derived, not a stored field: Completed = disbursed >= investment; Pending = 0 disbursed; Partially Disbursed = otherwise. Computed per facility-investor stake and re-aggregated per investor in the investors[] section.",
        snapshotVsWindowed:
          'kpis.total_investment, kpis.remaining_liability, and every pending_amount/completion_pct figure are current-state (all-time) and ignore the date range; only disbursed-amount and trend-chart figures are windowed by startDate/endDate.',
        remainingLiabilityTrend:
          'cumulative_disbursed is computed over full history; the date range only limits which period rows are returned, not which disbursements count toward the running total',
        forecast:
          'avgMonthlyDisbursement is the mean of the trailingMonths most recent months with activity in scope; requiredMonthlyProfitForTarget assumes future facility profit is split pro-rata across investors by ownership_percentage',
      },
    },
    kpis: {
      total_investment: money(total_investment),
      total_amount_disbursed: money(total_amount_disbursed),
      disbursed_pct,
      remaining_liability: money(remaining_liability),
      highestPendingInvestor,
      comparison: query.startDate && query.endDate
        ? {
            startDate: query.startDate,
            endDate: query.endDate,
            total_amount_disbursed_change_pct: changePctFor(query.startDate, query.endDate, 'disbursed-total'),
          }
        : null,
    },
    profitByFacility,
    trends: {
      monthlyDisbursement,
      profitVsDisbursement,
      remainingLiability: remainingLiabilityTrend,
    },
    facilityComparison,
    investors,
    forecast,
  };
}
