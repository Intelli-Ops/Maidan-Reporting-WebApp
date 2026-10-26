import { MOCK_FACILITIES, MOCK_PAYMENT_METHODS } from '@/mocks/bookingsFixtures';
import { mulberry32, seedFor, monthStart, toApiDatetime, toDateStr, parseDate } from '@/mocks/mockRandom';
import type {
  AccountReferenceData,
  ExpenseCategory,
} from '@/lib/types/lookups';
import type {
  CategoryShareOverTimeRow,
  ExpenseByCategoryRow,
  ExpenseByFacilityRow,
  ExpenseByPaymentMethodRow,
  ExpenseTrendRow,
  ExpenseGranularity,
  ExpensesDashboardData,
  LikeForLikeMonthRow,
} from '@/lib/types/expensesDashboard';

export const MOCK_CATEGORIES: ExpenseCategory[] = [
  { id: 1, name: 'Utilities', parent_category_id: null },
  { id: 2, name: 'Maintenance', parent_category_id: null },
  { id: 3, name: 'Staff', parent_category_id: null },
  { id: 4, name: 'Supplies', parent_category_id: null },
  { id: 11, name: 'Electricity', parent_category_id: 1 },
  { id: 12, name: 'Water', parent_category_id: 1 },
  { id: 21, name: 'Equipment Repair', parent_category_id: 2 },
  { id: 22, name: 'Grounds Keeping', parent_category_id: 2 },
  { id: 31, name: 'Salaries', parent_category_id: 3 },
  { id: 32, name: 'Overtime', parent_category_id: 3 },
  { id: 41, name: 'Sports Equipment', parent_category_id: 4 },
  { id: 42, name: 'Cleaning Supplies', parent_category_id: 4 },
];

const LEAF_CATEGORIES = MOCK_CATEGORIES.filter((c) => c.parent_category_id !== null);

const CATEGORY_BASE: Record<number, number> = {
  11: 45_000,
  12: 18_000,
  21: 22_000,
  22: 15_000,
  31: 180_000,
  32: 25_000,
  41: 30_000,
  42: 8_000,
};

const MOCK_ACCOUNT_MAP: AccountReferenceData['mapping'] = [
  { raw: 'Air Field', accountType: 'Air Field', bankName: null },
  { raw: 'Maidan Core', accountType: 'Maidan Core', bankName: null },
  { raw: 'BAHL Airfield', accountType: 'Air Field', bankName: 'Bank Al Habib' },
  { raw: 'BAHL Maidan Core', accountType: 'Maidan Core', bankName: 'Bank Al Habib' },
  { raw: 'Faysal Core', accountType: 'Maidan Core', bankName: 'Faysal Bank' },
  { raw: 'Meezan Airfield', accountType: 'Air Field', bankName: 'Meezan Bank' },
];

export function getAccountReferenceMock(): AccountReferenceData {
  const accountTypes = [...new Set(MOCK_ACCOUNT_MAP.map((m) => m.accountType))];
  const bankNames = [...new Set(MOCK_ACCOUNT_MAP.filter((m) => m.bankName).map((m) => m.bankName as string))].sort();
  return { accountTypes, bankNames, mapping: MOCK_ACCOUNT_MAP };
}

interface AccountOption {
  accountType: string | null;
  bankName: string | null;
  weight: number;
}

// Cash-heavy weighting with a 'null/null' bucket for unlinked/petty-cash
// expenses, matching the real ACCOUNT_MAP's documented ~27% cash share.
const ACCOUNT_OPTIONS: AccountOption[] = [
  { accountType: null, bankName: null, weight: 0.27 },
  { accountType: 'Air Field', bankName: null, weight: 0.1 },
  { accountType: 'Maidan Core', bankName: null, weight: 0.1 },
  { accountType: 'Air Field', bankName: 'Bank Al Habib', weight: 0.15 },
  { accountType: 'Maidan Core', bankName: 'Bank Al Habib', weight: 0.13 },
  { accountType: 'Maidan Core', bankName: 'Faysal Bank', weight: 0.15 },
  { accountType: 'Air Field', bankName: 'Meezan Bank', weight: 0.1 },
];

function weightedPick<T>(items: { item: T; weight: number }[], r: number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const target = r * total;
  let acc = 0;
  for (const { item, weight } of items) {
    acc += weight;
    if (target <= acc) return item;
  }
  return items[items.length - 1].item;
}

function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let d = parseDate(startDate);
  const end = parseDate(endDate);
  let guard = 0;
  while (d <= end && guard < 400) {
    out.push(toDateStr(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    guard++;
  }
  return out;
}

function isoWeekStart(dateStr: string): string {
  const d = parseDate(dateStr);
  const diffToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
  return toDateStr(monday);
}

interface Transaction {
  date: string;
  facility_id: number;
  category_id: number;
  amount: number;
  payment_method_id: number;
  payment_method_name: string;
  account_type: string | null;
  bank_name: string | null;
}

function generateUniverse(startDate: string, endDate: string): Transaction[] {
  const dates = eachDate(startDate, endDate);
  const paymentOptions = MOCK_PAYMENT_METHODS.map((pm) => ({ item: pm, weight: pm.share }));
  const categoryOptions = LEAF_CATEGORIES.map((c) => ({ item: c, weight: 1 }));
  const accountOptions = ACCOUNT_OPTIONS.map((a) => ({ item: a, weight: a.weight }));

  const transactions: Transaction[] = [];
  for (const date of dates) {
    for (const facility of MOCK_FACILITIES) {
      const dayRand = mulberry32(seedFor(date, facility.facility_id, 'expenseCount'));
      const numTx = 1 + Math.floor(dayRand() * 3); // 1-3 transactions/facility/day

      for (let i = 0; i < numTx; i++) {
        const rand = mulberry32(seedFor(date, facility.facility_id, 'exp', i));
        const category = weightedPick(categoryOptions, rand());
        const amount = CATEGORY_BASE[category.id] * (0.6 + rand() * 0.8);
        const paymentMethod = weightedPick(paymentOptions, rand());
        const accountOption =
          paymentMethod.payment_method_name === 'Cash'
            ? { accountType: null, bankName: null }
            : weightedPick(accountOptions, rand());

        transactions.push({
          date,
          facility_id: facility.facility_id,
          category_id: category.id,
          amount,
          payment_method_id: paymentMethod.payment_method_id,
          payment_method_name: paymentMethod.payment_method_name,
          account_type: accountOption.accountType,
          bank_name: accountOption.bankName,
        });
      }
    }
  }
  return transactions;
}

function money(n: number): string {
  return n.toFixed(2);
}

// Deterministic pseudo "vs previous period" movement — mirrors the shape of
// the real backend's comparison fields (see expenseDashboard.service.js)
// without a second synthetic universe pass.
function changePctFor(...parts: (string | number)[]): number {
  const raw = ((Math.abs(seedFor(...parts, 'chg')) % 400) - 200) / 10; // -20.0 .. +20.0
  return Math.round(raw * 10) / 10;
}

function topCategoryOf(categoryId: number): { id: number; name: string } {
  const cat = MOCK_CATEGORIES.find((c) => c.id === categoryId)!;
  const topId = cat.parent_category_id ?? cat.id;
  const top = MOCK_CATEGORIES.find((c) => c.id === topId)!;
  return { id: top.id, name: top.name };
}

export interface ExpensesMockQuery {
  startDate?: string;
  endDate?: string;
  facilityIds: string[];
  categoryIds: string[];
  subcategoryIds: string[];
  paymentMethodIds: string[];
  accountTypes: string[];
  bankNames: string[];
  granularity: ExpenseGranularity;
}

// Mirrors services/expenseDashboard.service.js: expense_scope is filtered
// once per section with the same applyFacility/applyCategory toggles the
// real buildExpenseScope() exposes, so byFacility/categoryShareOverTime
// reproduce the exact filter-obedience exceptions documented in meta.
export function buildExpensesDashboardMock(query: ExpensesMockQuery): ExpensesDashboardData {
  const endDate = query.endDate ?? toDateStr(new Date());
  const startDate = query.startDate ?? toDateStr(new Date(Date.now() - 29 * 86400000));

  // Generate a wide-enough universe to also cover the "previous period" the
  // delta calculation needs, without regenerating per call.
  const universeStart = toDateStr(new Date(parseDate(startDate).getTime() - 60 * 86400000));
  const universe = generateUniverse(universeStart, endDate);

  const facilityFilter = new Set(query.facilityIds.filter((id) => id !== 'null').map(Number));
  const categoryFilterIds = query.categoryIds.filter((id) => id !== 'null').map(Number);
  const subcategoryFilter = new Set(query.subcategoryIds.filter((id) => id !== 'null').map(Number));
  const paymentFilter = query.paymentMethodIds.length
    ? new Set(query.paymentMethodIds.map((id) => (id === 'null' ? 0 : Number(id))))
    : null;
  const accountTypeFilter = new Set(query.accountTypes.map((t) => t.toLowerCase()));
  const wantsNullAccountType = query.accountTypes.some((t) => t.toLowerCase() === 'null');
  const bankFilter = new Set(query.bankNames.map((b) => b.toLowerCase()));
  const wantsNullBank = query.bankNames.some((b) => b.toLowerCase() === 'null');

  const categoryRollup = new Set<number>();
  for (const id of categoryFilterIds) {
    categoryRollup.add(id);
    for (const c of MOCK_CATEGORIES) if (c.parent_category_id === id) categoryRollup.add(c.id);
  }

  const inRange = (date: string, start = startDate, end = endDate) => date >= start && date <= end;
  const matchesFacility = (facilityId: number) => facilityFilter.size === 0 || facilityFilter.has(facilityId);
  const matchesCategory = (categoryId: number) => {
    if (categoryRollup.size > 0 && !categoryRollup.has(categoryId)) return false;
    if (subcategoryFilter.size > 0 && !subcategoryFilter.has(categoryId)) return false;
    return true;
  };
  const matchesPayment = (paymentMethodId: number) => !paymentFilter || paymentFilter.has(paymentMethodId);
  const matchesAccountType = (accountType: string | null) => {
    if (accountTypeFilter.size === 0 && !wantsNullAccountType) return true;
    if (accountType === null) return wantsNullAccountType;
    return accountTypeFilter.has(accountType.toLowerCase());
  };
  const matchesBank = (bankName: string | null) => {
    if (bankFilter.size === 0 && !wantsNullBank) return true;
    if (bankName === null) return wantsNullBank;
    return bankFilter.has(bankName.toLowerCase());
  };

  function scope(opts: { applyFacility?: boolean; applyCategory?: boolean; start?: string; end?: string } = {}) {
    const { applyFacility = true, applyCategory = true, start = startDate, end = endDate } = opts;
    return universe
      .filter((t) => inRange(t.date, start, end))
      .filter((t) => !applyFacility || matchesFacility(t.facility_id))
      .filter((t) => !applyCategory || matchesCategory(t.category_id))
      .filter((t) => matchesPayment(t.payment_method_id))
      .filter((t) => matchesAccountType(t.account_type))
      .filter((t) => matchesBank(t.bank_name));
  }

  // --- kpis ---
  const fullScope = scope();
  const totalExpenseAmount = fullScope.reduce((sum, t) => sum + t.amount, 0);
  const cashAmount = fullScope.filter((t) => t.payment_method_name.toLowerCase() === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const nonCashAmount = totalExpenseAmount - cashAmount;

  // --- byFacility (ignores facilityId — always all 3 facilities) ---
  const facilityScope = scope({ applyFacility: false });
  const facilityBuckets = new Map<number, { count: number; amount: number }>();
  for (const t of facilityScope) {
    const b = facilityBuckets.get(t.facility_id) ?? { count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    facilityBuckets.set(t.facility_id, b);
  }
  const facilityGrandTotal = [...facilityBuckets.values()].reduce((sum, v) => sum + v.amount, 0);
  const byFacility: ExpenseByFacilityRow[] = MOCK_FACILITIES.map((f) => {
    const b = facilityBuckets.get(f.facility_id) ?? { count: 0, amount: 0 };
    return {
      facility_id: f.facility_id,
      facility_code: f.facility_code,
      facility_name: f.facility_name,
      expense_count: b.count,
      total_amount: money(b.amount),
      share_pct: facilityGrandTotal > 0 ? ((b.amount / facilityGrandTotal) * 100).toFixed(2) : null,
      total_amount_change_pct: changePctFor(startDate, endDate, 'facility', f.facility_id),
    };
  });
  const topFacilityRow = byFacility.reduce<ExpenseByFacilityRow | null>(
    (best, row) => (!best || Number(row.total_amount) > Number(best.total_amount) ? row : best),
    null
  );

  // --- delta (compares [startDate,endDate] to the immediately preceding window of equal length) ---
  const lengthDays = Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86400000) + 1;
  const prevEnd = toDateStr(new Date(parseDate(startDate).getTime() - 86400000));
  const prevStart = toDateStr(new Date(parseDate(prevEnd).getTime() - (lengthDays - 1) * 86400000));
  const periodTotals = (start: string, end: string) => {
    const rows = scope({ start, end });
    return { totalAmount: rows.reduce((sum, t) => sum + t.amount, 0), totalTransactions: rows.length };
  };
  const currentPeriod = periodTotals(startDate, endDate);
  const previousPeriod = periodTotals(prevStart, prevEnd);
  const deltaAmount = Number((currentPeriod.totalAmount - previousPeriod.totalAmount).toFixed(2));
  const deltaPct = previousPeriod.totalAmount !== 0 ? Number(((deltaAmount / previousPeriod.totalAmount) * 100).toFixed(2)) : null;

  // --- expenseTrend (full scope) ---
  const periodOf = (date: string) => (query.granularity === 'monthly' ? monthStart(date) : isoWeekStart(date));
  const trendBuckets = new Map<string, { count: number; amount: number }>();
  for (const t of fullScope) {
    const period = periodOf(t.date);
    const b = trendBuckets.get(period) ?? { count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    trendBuckets.set(period, b);
  }
  const expenseTrendRows: ExpenseTrendRow[] = [...trendBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period: toApiDatetime(period), expense_count: v.count, total_amount: money(v.amount) }));

  // --- byPaymentMethod (full scope) ---
  const paymentBuckets = new Map<number, { name: string; count: number; amount: number }>();
  for (const t of fullScope) {
    const b = paymentBuckets.get(t.payment_method_id) ?? { name: t.payment_method_name, count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    paymentBuckets.set(t.payment_method_id, b);
  }
  const byPaymentMethod: ExpenseByPaymentMethodRow[] = [...paymentBuckets.entries()]
    .map(([payment_method_id, v]) => ({
      payment_method_id,
      payment_method_name: v.name,
      expense_count: v.count,
      total_amount: money(v.amount),
      total_amount_change_pct: changePctFor(startDate, endDate, 'payment', payment_method_id),
    }))
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount));

  // --- byCategory (full scope, including category/subcategory filter — respects it, unlike categoryShareOverTime) ---
  const categoryBuckets = new Map<number, { name: string; count: number; amount: number }>();
  for (const t of fullScope) {
    const top = topCategoryOf(t.category_id);
    const b = categoryBuckets.get(top.id) ?? { name: top.name, count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    categoryBuckets.set(top.id, b);
  }
  const categoryGrandTotal = [...categoryBuckets.values()].reduce((sum, v) => sum + v.amount, 0);
  const byCategory: ExpenseByCategoryRow[] = [...categoryBuckets.entries()]
    .map(([top_category_id, v]) => ({
      top_category_id,
      category_name: v.name,
      expense_count: v.count,
      total_amount: money(v.amount),
      share_pct: categoryGrandTotal > 0 ? ((v.amount / categoryGrandTotal) * 100).toFixed(2) : null,
      total_amount_change_pct: changePctFor(startDate, endDate, 'category', top_category_id),
    }))
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount));

  // --- categoryShareOverTime (ignores categoryId/subcategoryId — always all top-level categories) ---
  const categoryTimeScope = scope({ applyCategory: false });
  const categoryTimeBuckets = new Map<string, { name: string; count: number; amount: number }>();
  for (const t of categoryTimeScope) {
    const top = topCategoryOf(t.category_id);
    const period = periodOf(t.date);
    const key = `${period}|${top.id}`;
    const b = categoryTimeBuckets.get(key) ?? { name: top.name, count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    categoryTimeBuckets.set(key, b);
  }
  const periodTotalsMap = new Map<string, number>();
  for (const [key, v] of categoryTimeBuckets) {
    const period = key.split('|')[0];
    periodTotalsMap.set(period, (periodTotalsMap.get(period) ?? 0) + v.amount);
  }
  const categoryShareOverTimeRows: CategoryShareOverTimeRow[] = [...categoryTimeBuckets.entries()]
    .map(([key, v]) => {
      const [period, topIdStr] = key.split('|');
      const periodTotal = periodTotalsMap.get(period) ?? 0;
      return {
        period: toApiDatetime(period),
        top_category_id: Number(topIdStr),
        category_name: v.name,
        expense_count: v.count,
        total_amount: money(v.amount),
        share_pct: periodTotal > 0 ? ((v.amount / periodTotal) * 100).toFixed(2) : null,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.top_category_id - b.top_category_id);

  // --- likeForLikeMonth (full scope) ---
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const likeBuckets = new Map<string, { year: number; month: number; count: number; amount: number }>();
  for (const t of fullScope) {
    const d = parseDate(t.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const b = likeBuckets.get(key) ?? { year: d.getFullYear(), month: d.getMonth() + 1, count: 0, amount: 0 };
    b.count += 1;
    b.amount += t.amount;
    likeBuckets.set(key, b);
  }
  const likeForLikeMonth: LikeForLikeMonthRow[] = [...likeBuckets.values()]
    .sort((a, b) => a.month - b.month || a.year - b.year)
    .map((v) => ({
      year: v.year,
      month_number: v.month,
      month_name: monthNames[v.month - 1],
      expense_count: v.count,
      total_amount: money(v.amount),
    }));

  return {
    meta: {
      filters: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        facilityId: query.facilityIds.length ? query.facilityIds : null,
        categoryId: query.categoryIds.length ? query.categoryIds : null,
        subcategoryId: query.subcategoryIds.length ? query.subcategoryIds : null,
        paymentMethodId: query.paymentMethodIds.length ? query.paymentMethodIds : null,
        accountType: query.accountTypes.length ? query.accountTypes : null,
        sourceBank: query.bankNames.length ? query.bankNames : null,
        granularity: query.granularity,
      },
      filterObedience: {
        byFacility: 'ignores facilityId — always returns all facilities (spec requirement; only meaningful in the "All facilities" view)',
        categoryShareOverTime: 'ignores categoryId/subcategoryId — always returns all top-level categories (spec requirement)',
      },
      notes: {
        omittedMetrics:
          "2 spec metrics are intentionally not implemented, by explicit product decision: (1) 'expense limit left this week' per facility — no budget/limit value exists anywhere in the schema; (2) 'Pending / unrecorded amount' — expenses.amount is NOT NULL and every live row has a real value, so there is nothing to compute.",
        accountTypeAndBank:
          "source_account is free text from the import pipeline, not a lookup table. It is normalized into accountType ('Air Field' / 'Maidan Core') and bankName via an exact-match table. Cash expenses (no source_account) are null/null, matched by the 'null' filter token.",
        delta:
          'v1 heuristic: compares the requested [startDate, endDate] window to the immediately preceding window of equal length, so it generalizes both week-over-week and month-over-month depending on the range length the caller passes. Defaults to a trailing 30-day window ending on the latest expense_date in the table when no date range is given.',
        categoryRollup:
          "every expense in the live data is recorded against a leaf subcategory, never a parent category directly; categoryId therefore rolls up to include all of that category's children, and byCategory/likeForLikeMonth report at the top-level-category rollup.",
      },
    },
    kpis: {
      total_transactions: fullScope.length,
      total_expense_amount: money(totalExpenseAmount),
      cash_amount: money(cashAmount),
      non_cash_amount: money(nonCashAmount),
      cash_pct: totalExpenseAmount > 0 ? ((cashAmount / totalExpenseAmount) * 100).toFixed(2) : null,
      non_cash_pct: totalExpenseAmount > 0 ? ((nonCashAmount / totalExpenseAmount) * 100).toFixed(2) : null,
      topFacility: topFacilityRow
        ? {
            facilityId: topFacilityRow.facility_id,
            facilityCode: topFacilityRow.facility_code,
            facilityName: topFacilityRow.facility_name,
            totalAmount: topFacilityRow.total_amount,
          }
        : null,
      delta: {
        currentPeriod: { startDate, endDate, totalAmount: Number(currentPeriod.totalAmount.toFixed(2)), totalTransactions: currentPeriod.totalTransactions },
        previousPeriod: {
          startDate: prevStart,
          endDate: prevEnd,
          totalAmount: Number(previousPeriod.totalAmount.toFixed(2)),
          totalTransactions: previousPeriod.totalTransactions,
        },
        deltaAmount,
        deltaPct,
      },
      comparison: {
        startDate: prevStart,
        endDate: prevEnd,
        total_transactions_change_pct: changePctFor(startDate, endDate, 'transactions'),
        cash_pct_change_pp: changePctFor(startDate, endDate, 'cash-pp') / 5, // scale to plausible pp range
        non_cash_pct_change_pp: changePctFor(startDate, endDate, 'non-cash-pp') / 5,
      },
    },
    byFacility,
    expenseTrend: { granularity: query.granularity, rows: expenseTrendRows },
    byPaymentMethod,
    byCategory,
    categoryShareOverTime: { granularity: query.granularity, rows: categoryShareOverTimeRows },
    likeForLikeMonth,
  };
}
