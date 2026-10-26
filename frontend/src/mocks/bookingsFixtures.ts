import type {
  BankVsMaidanDiscountShare,
  BookingsDashboardData,
  DiscountBurdenRow,
  FacilityBreakdownRow,
  FacilityShareOverTimeRow,
  Granularity,
  LikeForLikeDay,
  LikeForLikeDayRow,
  PaymentMethodBreakdownRow,
  RevenueHeatmapCell,
  RevenueTrendRow,
  SportBreakdownRow,
  TimeSlotRow,
  UnderusedBinRow,
} from '@/lib/types/bookingsDashboard';

export const MOCK_FACILITIES = [
  { facility_id: 1, facility_code: 'KMC', facility_name: 'Maidan KMC', tilt: 1.0 },
  { facility_id: 2, facility_code: 'EMR', facility_name: 'Maidan Emaar', tilt: 1.25 },
  { facility_id: 3, facility_code: 'MCT', facility_name: 'Maidan Malir Cantt', tilt: 0.8 },
];

export const MOCK_SPORTS = [
  { sport_type_id: 1, sport_name: 'Padel', share: 0.45 },
  { sport_type_id: 2, sport_name: 'Tennis', share: 0.3 },
  { sport_type_id: 3, sport_name: 'Futsal', share: 0.25 },
];

export const MOCK_PAYMENT_METHODS = [
  { payment_method_id: 1, payment_method_name: 'Cash', share: 0.35 },
  { payment_method_id: 2, payment_method_name: 'Card', share: 0.3 },
  { payment_method_id: 3, payment_method_name: 'Bank Transfer', share: 0.2 },
  { payment_method_id: 4, payment_method_name: 'EasyPaisa', share: 0.1 },
  { payment_method_id: 0, payment_method_name: 'Unspecified', share: 0.05 },
];

// Card types mirror the shape of real bank_bin_reference data — free text
// naming a network, a tier and a funding type in no fixed order — so the mock
// exercises the same normalization path the live data does. Several banks
// carry multiple cards so the bank search has something to find.
const MOCK_BINS = [
  { bin_number: '411111', bank_name: 'Meezan Bank', card_type: 'Visa Infinite Debit Card', discount_pct: '0.4000', discount_cap: '5000.00' },
  { bin_number: '411145', bank_name: 'Meezan Bank', card_type: 'MasterCard Gold Credit Card', discount_pct: '0.1500', discount_cap: '500.00' },
  { bin_number: '424242', bank_name: 'HBL', card_type: 'MasterCard World Elite Debit Card', discount_pct: '0.2000', discount_cap: '1000.00' },
  { bin_number: '424288', bank_name: 'HBL', card_type: 'VISA Green Credit Card', discount_pct: '0.1000', discount_cap: '400.00' },
  { bin_number: '424299', bank_name: 'HBL', card_type: 'MasterCard HBL Gold Debit Card', discount_pct: '0.1200', discount_cap: '600.00' },
  { bin_number: '450875', bank_name: 'UBL', card_type: 'Signature Master Debit', discount_pct: '0.3000', discount_cap: '4000.00' },
  { bin_number: '450880', bank_name: 'UBL', card_type: 'VISA Classic Debit Card', discount_pct: '0.1000', discount_cap: '300.00' },
  { bin_number: '520123', bank_name: 'Bank Alfalah', card_type: 'Visa Infinite Credit Card', discount_pct: '0.5000', discount_cap: '15000.00' },
  { bin_number: '520155', bank_name: 'Bank Alfalah', card_type: 'Premium Signature Debit Card', discount_pct: '0.4000', discount_cap: '5000.00' },
  { bin_number: '535987', bank_name: 'Faysal Bank', card_type: 'Visa Platinum Debit Card', discount_pct: '0.2500', discount_cap: '1500.00' },
  { bin_number: '601123', bank_name: 'Standard Chartered', card_type: 'Titanium & Priority Debit Master Card', discount_pct: '0.3000', discount_cap: '2000.00' },
  { bin_number: '601188', bank_name: 'Standard Chartered', card_type: 'Tap Pay – App & Google wallet', discount_pct: '0.0800', discount_cap: '250.00' },
];

// Stand-in for the real query's "period average gross booking", used to model
// what an unused card would have saved. Roughly the live figure.
const MOCK_AVG_GROSS = 8300;

// Mirrors services/cardType.js — the real payload arrives with tier/network/
// funding/card_label already derived server-side, so the mock has to derive
// them too or mock mode renders a differently-shaped row than production.
// Kept deliberately small: it only has to cover the MOCK_BINS strings above.
const MOCK_TIER_RULES: [string, number, RegExp][] = [
  ['Infinite', 1, /infinite/i],
  ['World Elite', 2, /world\s*elite/i],
  ['Signature', 3, /signature/i],
  ['Platinum', 4, /platinum/i],
  ['Titanium', 5, /titanium/i],
  ['World', 6, /world/i],
  ['Premium', 7, /premi(um|er)/i],
  ['Gold', 8, /gold/i],
  ['Green', 9, /green/i],
  ['Classic', 10, /classic/i],
  ['Standard', 13, /standard|debit|credit|card|wallet|pay/i],
];

function normalizeMockCardType(cardType: string) {
  const raw = cardType.trim();
  const tierHit = MOCK_TIER_RULES.find(([, , re]) => re.test(raw)) ?? null;
  const network =
    (/visa/i.test(raw) && 'Visa') || (/master\s*card|mastercard|\bmaster\b/i.test(raw) && 'Mastercard') || null;
  const funding = (/credit/i.test(raw) && 'Credit') || (/debit/i.test(raw) && 'Debit') || null;

  const parts = [network, tierHit?.[0] ?? null, funding].filter(Boolean) as string[];
  // Bare "Standard" carries nothing the raw string didn't — same fallback the
  // backend applies.
  const bareStandard = parts.length === 1 && tierHit?.[0] === 'Standard';

  return {
    tier: tierHit?.[0] ?? null,
    tier_rank: tierHit?.[1] ?? null,
    network,
    funding,
    card_label: parts.length === 0 || bareStandard ? raw : parts.join(' · '),
  };
}

// Deterministic PRNG so mock numbers don't jitter between renders/filters —
// same inputs always produce the same "random" figures.
function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(...parts: (string | number)[]): number {
  const str = parts.join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Deterministic pseudo "vs previous period" movement for mock KPIs/rows —
// mirrors the shape of the real backend's comparison block (see
// dashboard.service.js getKpis) without needing a second synthetic period.
function changePctFor(...parts: (string | number)[]): number {
  const raw = ((Math.abs(seedFor(...parts, 'chg')) % 400) - 200) / 10; // -20.0 .. +20.0
  return Math.round(raw * 10) / 10;
}

function previousPeriodRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { startDate: toDateStr(prevStart), endDate: toDateStr(prevEnd) };
}

// How many times ISO weekday `isoDow` (1=Mon..7=Sun) falls inside the
// inclusive range — mirrors countWeekdayOccurrences in
// services/dashboard.service.js, the denominator behind every weekday average.
function countWeekdayOccurrences(startDate: string, endDate: string, isoDow: number): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) return 0;
  const startDow = isoWeekday(startDate);
  const offset = (isoDow - startDow + 7) % 7;
  if (offset >= totalDays) return 0;
  return Math.floor((totalDays - offset - 1) / 7) + 1;
}

function isoWeekday(dateStr: string): number {
  const day = parseDate(dateStr).getDay(); // 0=Sun
  return day === 0 ? 7 : day;
}

function isoWeekStart(dateStr: string): string {
  const d = parseDate(dateStr);
  const diffToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
  return toDateStr(monday);
}

function monthStart(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let d = parseDate(startDate);
  const end = parseDate(endDate);
  // Hard cap so an unbounded/huge range can't hang the mock generator.
  let guard = 0;
  while (d <= end && guard < 400) {
    out.push(toDateStr(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    guard++;
  }
  return out;
}

interface DayFacilityRecord {
  date: string;
  facility_id: number;
  bookings: number;
  gross: number;
  net: number;
  discount: number;
  // per-sport split of this day/facility's bookings & revenue
  bySport: { sport_type_id: number; bookings: number; revenue: number }[];
  // per-payment-method split of this day/facility's revenue
  byPayment: { payment_method_id: number; bookings: number; revenue: number }[];
}

function generateUniverse(startDate: string, endDate: string): DayFacilityRecord[] {
  const dates = eachDate(startDate, endDate);
  const records: DayFacilityRecord[] = [];

  for (const date of dates) {
    const weekday = isoWeekday(date); // 1..7, 6/7 = weekend
    const weekendBoost = weekday >= 6 ? 1.4 : 1.0;

    for (const facility of MOCK_FACILITIES) {
      const rand = mulberry32(seedFor(date, facility.facility_id));
      const baseBookings = 8 + rand() * 6; // 8-14 baseline
      const bookings = Math.max(0, Math.round(baseBookings * weekendBoost * facility.tilt));
      const avgPrice = 3200 + rand() * 1800; // PKR 3200-5000 per booking
      const gross = bookings * avgPrice;
      const discountRate = 0.05 + rand() * 0.1; // 5-15%
      const discount = gross * discountRate;
      const net = gross - discount;

      const bySport = MOCK_SPORTS.map((sport) => {
        const jitter = 0.85 + rand() * 0.3;
        const sportBookings = Math.round(bookings * sport.share * jitter);
        return { sport_type_id: sport.sport_type_id, bookings: sportBookings, revenue: net * sport.share * jitter };
      });

      const byPayment = MOCK_PAYMENT_METHODS.map((pm) => {
        const jitter = 0.85 + rand() * 0.3;
        const pmBookings = Math.round(bookings * pm.share * jitter);
        return { payment_method_id: pm.payment_method_id, bookings: pmBookings, revenue: net * pm.share * jitter };
      });

      records.push({ date, facility_id: facility.facility_id, bookings, gross, net, discount, bySport, byPayment });
    }
  }

  return records;
}

function money(n: number): string {
  return n.toFixed(2);
}

// --- byTimeSlot ---------------------------------------------------------
//
// Shaped to look like the real thing rather than uniformly random: the live
// data is an evening business (busiest 4pm-3am, near-dead 11am-3pm), and a
// flat distribution would make the slot charts look fine in mock mode while
// hiding the very skew they exist to show. Weights are per START HOUR, 0-23.
const MOCK_HOUR_WEIGHTS = [
  9, 7, 4, 2, 1, 1, 2, 2, 1, 1, 1, 1, // 00-11
  1, 1, 1, 2, 6, 7, 7, 9, 10, 10, 11, 10, // 12-23
];

// Roughly the live mix, and deliberately NOT even: Done dominates, and the
// long tail is what exercises the stacked chart's legend and tooltip.
const MOCK_STATUS_SHARES: [string, number][] = [
  ['Done', 0.64],
  ['Academy', 0.12],
  ['Cancel', 0.07],
  ['Pending', 0.06],
  ['Complimentary', 0.05],
  ['Payfast', 0.03],
  ['Pending Tournament', 0.03],
];

function buildTimeSlotRows(startDate: string, endDate: string, totalBookings: number): TimeSlotRow[] {
  const rand = mulberry32(seedFor(startDate, endDate, 'slots'));
  const rows: TimeSlotRow[] = [];

  // ~14% of bookings land in the null-hour bucket, matching the share of live
  // rows whose free-text slot never parsed — the "Unknown" bar and the
  // caption that explains it are both worth seeing in mock mode.
  const unknownTotal = Math.round(totalBookings * 0.14);
  const knownTotal = totalBookings - unknownTotal;
  const weightSum = MOCK_HOUR_WEIGHTS.reduce((a, b) => a + b, 0);

  function pushBucket(hour: number | null, count: number) {
    if (count <= 0) return;
    for (const [status, share] of MOCK_STATUS_SHARES) {
      const jitter = 0.8 + rand() * 0.4;
      const bookings = Math.round(count * share * jitter);
      if (bookings <= 0) continue;
      const net = bookings * (3200 + rand() * 1800);
      rows.push({
        slot_start_hour: hour,
        status,
        booking_count: bookings,
        net_revenue: money(net),
        total_hours: (bookings * 1.2).toFixed(2),
      });
    }
  }

  for (let hour = 0; hour < 24; hour += 1) {
    pushBucket(hour, Math.round((knownTotal * MOCK_HOUR_WEIGHTS[hour]) / weightSum));
  }
  pushBucket(null, unknownTotal);

  return rows;
}

export interface BookingsMockQuery {
  startDate?: string;
  endDate?: string;
  facilityIds: string[];
  sportTypeIds: string[];
  paymentMethodIds: string[];
  granularity: Granularity;
  binLimit: number;
}

export function buildBookingsDashboardMock(query: BookingsMockQuery): BookingsDashboardData {
  const endDate = query.endDate ?? toDateStr(new Date());
  const startDate = query.startDate ?? toDateStr(new Date(Date.now() - 29 * 86400000));

  const universe = generateUniverse(startDate, endDate);

  const facilityFilter = new Set(query.facilityIds.filter((id) => id !== 'null').map(Number));
  const sportFilter = new Set(query.sportTypeIds.filter((id) => id !== 'null').map(Number));
  const paymentFilter = query.paymentMethodIds.length
    ? new Set(query.paymentMethodIds.map((id) => (id === 'null' ? 0 : Number(id))))
    : null;

  const matchesFacility = (facilityId: number) => facilityFilter.size === 0 || facilityFilter.has(facilityId);

  // Fully filtered scope (date + facility + sport + payment method) — used
  // by kpis, revenueTrend, revenueHeatmap, likeForLikeDay, byPaymentMethod.
  function filteredRows() {
    return universe.filter((r) => matchesFacility(r.facility_id));
  }

  function sumFiltered(rows: DayFacilityRecord[]) {
    let bookings = 0;
    let gross = 0;
    let net = 0;
    let discount = 0;
    for (const r of rows) {
      for (const s of r.bySport) {
        if (sportFilter.size > 0 && !sportFilter.has(s.sport_type_id)) continue;
        const sportShareOfDay = r.bookings > 0 ? s.bookings / r.bookings : 0;
        for (const p of r.byPayment) {
          if (paymentFilter && !paymentFilter.has(p.payment_method_id)) continue;
          const pmShareOfDay = r.bookings > 0 ? p.bookings / r.bookings : 0;
          // approximate the sport x payment-method intersection as independent shares of the day
          const weight = sportShareOfDay * pmShareOfDay * (r.bookings || 1);
          bookings += weight;
          const revenueWeight = r.net > 0 ? weight / r.bookings || 0 : 0;
          net += r.net * revenueWeight;
          gross += r.gross * revenueWeight;
          discount += r.discount * revenueWeight;
        }
      }
    }
    return { bookings: Math.round(bookings), gross, net, discount };
  }

  const scoped = filteredRows();

  // --- kpis ---
  const totals = sumFiltered(scoped);
  const cancelRate = 3 + (Math.abs(seedFor(startDate, endDate)) % 500) / 100; // 3-8%, deterministic per range
  const cancelled = Math.round(totals.bookings * (cancelRate / 100));
  const totalHours = totals.bookings * 1.2;

  const prevRange = previousPeriodRange(startDate, endDate);

  const kpis: BookingsDashboardData['kpis'] = {
    total_bookings: totals.bookings,
    cancelled_bookings: cancelled,
    cancellation_rate_pct: cancelRate.toFixed(2),
    total_net_revenue: money(totals.net),
    total_gross_amount: money(totals.gross),
    total_discount_amount: money(totals.discount),
    total_hours: totalHours.toFixed(2),
    comparison: {
      startDate: prevRange.startDate,
      endDate: prevRange.endDate,
      total_bookings_change_pct: changePctFor(startDate, endDate, 'bookings'),
      total_net_revenue_change_pct: changePctFor(startDate, endDate, 'net'),
      total_gross_amount_change_pct: changePctFor(startDate, endDate, 'gross'),
      total_discount_amount_change_pct: changePctFor(startDate, endDate, 'discount'),
      cancellation_rate_change_pct: changePctFor(startDate, endDate, 'cancel'),
    },
  };

  // --- revenueTrend (granularity-aware, fully filtered) ---
  const trendBuckets = new Map<string, { count: number; net: number; discount: number }>();
  for (const r of scoped) {
    const sportOk = (sid: number) => sportFilter.size === 0 || sportFilter.has(sid);
    for (const s of r.bySport) {
      if (!sportOk(s.sport_type_id)) continue;
      const period =
        query.granularity === 'monthly' ? monthStart(r.date) : query.granularity === 'weekly' ? isoWeekStart(r.date) : r.date;
      const bucket = trendBuckets.get(period) ?? { count: 0, net: 0, discount: 0 };
      const sportRevenueShare = r.bookings > 0 ? s.bookings / r.bookings : 0;
      bucket.count += s.bookings;
      bucket.net += r.net * sportRevenueShare;
      bucket.discount += r.discount * sportRevenueShare;
      trendBuckets.set(period, bucket);
    }
  }
  const revenueTrend: { granularity: Granularity; rows: RevenueTrendRow[] } = {
    granularity: query.granularity,
    rows: [...trendBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({
        period: `${period}T00:00:00.000Z`,
        booking_count: v.count,
        net_revenue: money(v.net),
        discount_amount: money(v.discount),
      })),
  };

  // --- revenueHeatmap (calendar date x iso weekday, fully filtered) ---
  const heatmapBuckets = new Map<string, { count: number; net: number }>();
  for (const r of scoped) {
    for (const s of r.bySport) {
      if (sportFilter.size > 0 && !sportFilter.has(s.sport_type_id)) continue;
      const bucket = heatmapBuckets.get(r.date) ?? { count: 0, net: 0 };
      const sportRevenueShare = r.bookings > 0 ? s.bookings / r.bookings : 0;
      bucket.count += s.bookings;
      bucket.net += r.net * sportRevenueShare;
      heatmapBuckets.set(r.date, bucket);
    }
  }
  const revenueHeatmap: RevenueHeatmapCell[] = [...heatmapBuckets.entries()]
    .filter(([, v]) => v.count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      booking_date: `${date}T00:00:00.000Z`,
      iso_weekday: isoWeekday(date),
      booking_count: v.count,
      net_revenue: money(v.net),
    }));

  // --- byFacility (ignores facilityId, respects sport/payment/date) ---
  const facilityBuckets = new Map<number, { count: number; net: number; gross: number }>();
  for (const r of universe) {
    for (const s of r.bySport) {
      if (sportFilter.size > 0 && !sportFilter.has(s.sport_type_id)) continue;
      const b = facilityBuckets.get(r.facility_id) ?? { count: 0, net: 0, gross: 0 };
      const sportShare = r.bookings > 0 ? s.bookings / r.bookings : 0;
      b.count += s.bookings;
      b.net += r.net * sportShare;
      b.gross += r.gross * sportShare;
      facilityBuckets.set(r.facility_id, b);
    }
  }
  const grandGross = [...facilityBuckets.values()].reduce((sum, v) => sum + v.gross, 0);
  const byFacility: FacilityBreakdownRow[] = MOCK_FACILITIES.map((f) => {
    const b = facilityBuckets.get(f.facility_id) ?? { count: 0, net: 0, gross: 0 };
    return {
      facility_id: f.facility_id,
      facility_code: f.facility_code,
      facility_name: f.facility_name,
      booking_count: b.count,
      net_revenue: money(b.net),
      gross_amount: money(b.gross),
      gross_share_pct: grandGross > 0 ? ((b.gross / grandGross) * 100).toFixed(2) : null,
      net_revenue_change_pct: changePctFor(startDate, endDate, 'facility', f.facility_id),
    };
  });

  // --- facilityShareOverTime (weekly, ignores facilityId) ---
  const weekFacilityBuckets = new Map<string, { count: number; net: number }>();
  for (const r of universe) {
    const week = isoWeekStart(r.date);
    const key = `${week}|${r.facility_id}`;
    const b = weekFacilityBuckets.get(key) ?? { count: 0, net: 0 };
    b.count += r.bookings;
    b.net += r.net;
    weekFacilityBuckets.set(key, b);
  }
  const weekTotals = new Map<string, number>();
  for (const [key, v] of weekFacilityBuckets) {
    const week = key.split('|')[0];
    weekTotals.set(week, (weekTotals.get(week) ?? 0) + v.net);
  }
  const facilityShareOverTime: FacilityShareOverTimeRow[] = [...weekFacilityBuckets.entries()]
    .map(([key, v]) => {
      const [week, facilityIdStr] = key.split('|');
      const facility = MOCK_FACILITIES.find((f) => f.facility_id === Number(facilityIdStr))!;
      const weekTotal = weekTotals.get(week) ?? 0;
      return {
        week_start: `${week}T00:00:00.000Z`,
        facility_id: facility.facility_id,
        facility_code: facility.facility_code,
        facility_name: facility.facility_name,
        booking_count: v.count,
        net_revenue: money(v.net),
        revenue_share_pct: weekTotal > 0 ? ((v.net / weekTotal) * 100).toFixed(2) : null,
      };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  // --- discountBurdenByFacility (ignores facilityId) ---
  const discountBuckets = new Map<number, { discount: number; gross: number }>();
  for (const r of universe) {
    const b = discountBuckets.get(r.facility_id) ?? { discount: 0, gross: 0 };
    b.discount += r.discount;
    b.gross += r.gross;
    discountBuckets.set(r.facility_id, b);
  }
  const discountBurdenByFacility: DiscountBurdenRow[] = MOCK_FACILITIES.map((f) => {
    const b = discountBuckets.get(f.facility_id) ?? { discount: 0, gross: 0 };
    return {
      facility_id: f.facility_id,
      facility_code: f.facility_code,
      facility_name: f.facility_name,
      total_discount_amount: money(b.discount),
      total_gross_amount: money(b.gross),
      discount_burden_pct: b.gross > 0 ? ((b.discount / b.gross) * 100).toFixed(2) : '0.00',
      discount_burden_pct_change_pp: changePctFor(startDate, endDate, 'burden', f.facility_id) / 4, // scale to plausible pp range
    };
  });

  // --- bankVsMaidanDiscountShare (scoped to bookings with a matched BIN) ---
  const totalDiscountAllScope = scoped.reduce((sum, r) => sum + r.discount, 0);
  const withBinShare = 0.55; // ~55% of discounted bookings had a matched card BIN
  const bankAbsorbShare = 0.4; // banks absorb ~40% of matched-BIN discount, Maidan the rest
  const discountWithBin = totalDiscountAllScope * withBinShare;
  const bankVsMaidanDiscountShare: BankVsMaidanDiscountShare = {
    bookings_with_bin: Math.round(totals.bookings * withBinShare),
    total_discount_amount: money(discountWithBin),
    bank_absorbed_amount: money(discountWithBin * bankAbsorbShare),
    maidan_absorbed_amount: money(discountWithBin * (1 - bankAbsorbShare)),
  };

  // --- underusedHighValueBins ---
  // Returns EVERY mock BIN (not just the high-value slice) because the real
  // endpoint does: the client searches the full catalogue locally, and
  // zero-usage cards are the strongest "underused" signal rather than
  // something to filter out.
  const binRand = mulberry32(seedFor(startDate, endDate, 'bins'));
  const scored = MOCK_BINS.map((bin) => {
    // Roughly one card in six goes unused in a period, so the "never used"
    // path stays exercised in mock mode.
    const roll = binRand();
    const usage = roll < 0.17 ? 0 : Math.max(1, Math.round(2 + roll * 40));
    const modelled = Math.min(Number(bin.discount_pct) * MOCK_AVG_GROSS, Number(bin.discount_cap));
    return {
      ...bin,
      ...normalizeMockCardType(bin.card_type),
      usage_count: usage,
      usage_count_change_pct: usage === 0 ? -100 : changePctFor(startDate, endDate, 'binUsage', bin.bin_number),
      saving_is_measured: usage > 0,
      // Measured savings land a little under the modelled figure, the way
      // real baskets do once the cap and small bookings are mixed in.
      avg_saving: money(usage > 0 ? modelled * (0.82 + binRand() * 0.18) : modelled),
    };
  });

  // High value = top discount_pct quartile across all BINs, same rule as the
  // NTILE(4) in the real query.
  const byDiscount = [...scored].sort((a, b) => Number(b.discount_pct) - Number(a.discount_pct));
  const quartileSize = Math.ceil(byDiscount.length / 4);
  const highValueBins = new Set(byDiscount.slice(0, quartileSize).map((b) => b.bin_number));

  const underusedRows: UnderusedBinRow[] = scored
    .map((b) => ({ ...b, is_high_value: highValueBins.has(b.bin_number) }))
    .sort(
      (a, b) =>
        Number(b.is_high_value) - Number(a.is_high_value) ||
        a.usage_count - b.usage_count ||
        Number(b.discount_pct) - Number(a.discount_pct)
    );

  // --- bySport (ignores sportTypeId) ---
  const sportBuckets = new Map<number, { count: number; net: number }>();
  for (const r of universe) {
    if (!matchesFacility(r.facility_id)) continue;
    for (const s of r.bySport) {
      const b = sportBuckets.get(s.sport_type_id) ?? { count: 0, net: 0 };
      const sportShare = r.bookings > 0 ? s.bookings / r.bookings : 0;
      b.count += s.bookings;
      b.net += r.net * sportShare;
      sportBuckets.set(s.sport_type_id, b);
    }
  }
  const sportGrandNet = [...sportBuckets.values()].reduce((sum, v) => sum + v.net, 0);
  const bySport: SportBreakdownRow[] = MOCK_SPORTS.map((s) => {
    const b = sportBuckets.get(s.sport_type_id) ?? { count: 0, net: 0 };
    return {
      sport_type_id: s.sport_type_id,
      sport_name: s.sport_name,
      booking_count: b.count,
      net_revenue: money(b.net),
      revenue_share_pct: sportGrandNet > 0 ? ((b.net / sportGrandNet) * 100).toFixed(2) : null,
      net_revenue_change_pct: changePctFor(startDate, endDate, 'sport', s.sport_type_id),
    };
  }).sort((a, b) => Number(b.net_revenue) - Number(a.net_revenue));

  // --- likeForLikeDay (grouped by iso weekday x week, fully filtered) ---
  const weekdayLabels = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const likeBuckets = new Map<string, { count: number; net: number; weekday: number; week: string }>();
  for (const r of scoped) {
    for (const s of r.bySport) {
      if (sportFilter.size > 0 && !sportFilter.has(s.sport_type_id)) continue;
      const week = isoWeekStart(r.date);
      const weekday = isoWeekday(r.date);
      const key = `${week}|${weekday}`;
      const b = likeBuckets.get(key) ?? { count: 0, net: 0, weekday, week };
      const sportShare = r.bookings > 0 ? s.bookings / r.bookings : 0;
      b.count += s.bookings;
      b.net += r.net * sportShare;
      likeBuckets.set(key, b);
    }
  }
  const likeForLikeByWeek: LikeForLikeDayRow[] = [...likeBuckets.values()]
    .filter((v) => v.count > 0)
    .sort((a, b) => a.weekday - b.weekday || a.week.localeCompare(b.week))
    .map((v) => ({
      week_start: `${v.week}T00:00:00.000Z`,
      iso_weekday: v.weekday,
      weekday_label: weekdayLabels[v.weekday],
      booking_count: v.count,
      net_revenue: money(v.net),
    }));

  // Mirrors services/dashboard.service.js getLikeForLikeDay: per-weekday
  // averages divided by CALENDAR occurrences of that weekday in the window
  // (not weeks spanned, not days with bookings), compared against the same
  // figure over the preceding equal-length window.
  const weekdayWindow = (dow: number) => {
    const rows = likeForLikeByWeek.filter((r) => r.iso_weekday === dow);
    const occurrences = countWeekdayOccurrences(startDate, endDate, dow);
    const net = rows.reduce((s, r) => s + Number(r.net_revenue), 0);
    return {
      booking_count: rows.reduce((s, r) => s + r.booking_count, 0),
      occurrences,
      net_revenue: money(net),
      avg_per_occurrence: occurrences > 0 ? money(net / occurrences) : null,
    };
  };

  const likeForLikeDay: LikeForLikeDay = {
    comparison: { startDate: prevRange.startDate, endDate: prevRange.endDate },
    weekdays: [1, 2, 3, 4, 5, 6, 7].map((dow) => {
      const current = weekdayWindow(dow);
      // Synthesized rather than recomputed over a second universe, same
      // approach the mock KPI comparison block already takes.
      const changePct = changePctFor(startDate, endDate, 'weekday', dow);
      const prevAvg =
        current.avg_per_occurrence != null ? Number(current.avg_per_occurrence) / (1 + changePct / 100) : null;
      return {
        iso_weekday: dow,
        weekday_label: weekdayLabels[dow],
        current,
        previous:
          prevAvg == null
            ? null
            : {
                booking_count: Math.round(current.booking_count / (1 + changePct / 100)),
                occurrences: countWeekdayOccurrences(prevRange.startDate, prevRange.endDate, dow),
                net_revenue: money(prevAvg * current.occurrences),
                avg_per_occurrence: money(prevAvg),
              },
        change_pct: current.avg_per_occurrence != null ? changePct : null,
      };
    }),
    byWeek: likeForLikeByWeek,
  };

  // --- byPaymentMethod (fully filtered) ---
  const paymentBuckets = new Map<number, { count: number; net: number }>();
  for (const r of scoped) {
    for (const p of r.byPayment) {
      if (paymentFilter && !paymentFilter.has(p.payment_method_id)) continue;
      const b = paymentBuckets.get(p.payment_method_id) ?? { count: 0, net: 0 };
      b.count += p.bookings;
      b.net += p.revenue;
      paymentBuckets.set(p.payment_method_id, b);
    }
  }
  const byPaymentMethod: PaymentMethodBreakdownRow[] = MOCK_PAYMENT_METHODS.filter((pm) => paymentBuckets.has(pm.payment_method_id))
    .map((pm) => {
      const b = paymentBuckets.get(pm.payment_method_id)!;
      return {
        payment_method_id: pm.payment_method_id,
        payment_method_name: pm.payment_method_name,
        booking_count: b.count,
        net_revenue: money(b.net),
        net_revenue_change_pct: changePctFor(startDate, endDate, 'pm', pm.payment_method_id),
      };
    })
    .sort((a, b) => Number(b.net_revenue) - Number(a.net_revenue));

  // Both windows are generated from the same shaped distribution, with the
  // previous window's totals scaled by a deterministic per-range factor so
  // the comparison chart shows real movement rather than two identical bars.
  const prevScale = 0.8 + (Math.abs(seedFor(startDate, endDate, 'prevslots')) % 45) / 100; // 0.80-1.24
  const byTimeSlotCurrent = buildTimeSlotRows(startDate, endDate, totals.bookings);
  const byTimeSlotPrevious = buildTimeSlotRows(
    prevRange.startDate,
    prevRange.endDate,
    Math.round(totals.bookings * prevScale)
  );

  return {
    meta: {
      filters: {
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        facilityId: query.facilityIds.length ? query.facilityIds : null,
        sportTypeId: query.sportTypeIds.length ? query.sportTypeIds : null,
        paymentMethodId: query.paymentMethodIds.length ? query.paymentMethodIds : null,
        granularity: query.granularity,
      },
      filterObedience: {
        byFacility: 'ignores facilityId — always returns all facilities (spec requirement)',
        facilityShareOverTime: 'ignores facilityId — always returns all facilities (spec requirement)',
        discountBurdenByFacility: 'ignores facilityId — always returns all facilities (spec requirement)',
        bySport: 'ignores sportTypeId — always returns all activities (spec requirement)',
      },
      notes: {
        revenueHeatmap: 'calendar heatmap grouped by booking_date; time-of-day is not tracked',
        bankVsMaidanDiscountShare: 'scoped to bookings with a recorded bank BIN only',
        underusedHighValueBins:
          'Cards in the top quarter by discount rate, least-used first. Includes cards with no bookings at all in the period.',
        likeForLikeDay:
          "Each weekday's average revenue per occurrence — e.g. total Saturday revenue divided by the number of Saturdays in the range — against the same figure for the period immediately before.",
        byTimeSlot:
          'Grouped by the hour the slot starts, parsed from the free-text time slot. Bookings whose slot text could not be parsed are grouped under a null hour and shown as "Unknown".',
      },
    },
    kpis,
    revenueTrend,
    revenueHeatmap,
    byFacility,
    facilityShareOverTime,
    discountBurdenByFacility,
    bankVsMaidanDiscountShare,
    underusedHighValueBins: {
      binLimit: query.binLimit,
      highValueCount: underusedRows.filter((r) => r.is_high_value).length,
      rows: underusedRows,
    },
    bySport,
    likeForLikeDay,
    byPaymentMethod,
    byTimeSlot: {
      comparison: prevRange,
      // Same ordering rule as the server: every status in either window,
      // busiest first, so legend and stacking order stay put.
      statuses: MOCK_STATUS_SHARES.map(([status]) => status),
      current: byTimeSlotCurrent,
      previous: byTimeSlotPrevious,
    },
  };
}
