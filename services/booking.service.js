const pool = require('../db/pool');

async function getBookingSummary({ startDate, endDate, facilityId, sportTypeId }) {
  let whereClauses = [];
  let queryParams = [];
  let paramIdx = 1;

  if (startDate) {
    whereClauses.push(`b.booking_date >= $${paramIdx++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`b.booking_date <= $${paramIdx++}`);
    queryParams.push(endDate);
  }
  if (facilityId) {
    whereClauses.push(`b.facility_id = $${paramIdx++}`);
    queryParams.push(facilityId);
  }
  if (sportTypeId) {
    whereClauses.push(`b.sport_type_id = $${paramIdx++}`);
    queryParams.push(sportTypeId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // KPI Summary
  const summaryQuery = `
    SELECT 
      COUNT(*)::integer as total_bookings,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2) as total_net_revenue,
      COALESCE(SUM(b.gross_amount), 0)::numeric(14,2) as total_gross_amount,
      COALESCE(SUM(b.discount_amount), 0)::numeric(14,2) as total_discount_amount,
      COALESCE(SUM(b.duration_hours), 0)::numeric(10,2) as total_hours
    FROM bookings b
    ${whereSql}
  `;

  // Revenue by Facility
  const facilityBreakdownQuery = `
    SELECT 
      f.id as facility_id,
      f.code as facility_code,
      f.name as facility_name,
      COUNT(b.id)::integer as booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2) as net_revenue
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    ${whereSql}
    GROUP BY f.id, f.code, f.name
    ORDER BY net_revenue DESC
  `;

  // Revenue by Sport Type
  const sportBreakdownQuery = `
    SELECT 
      s.id as sport_type_id,
      s.name as sport_name,
      COUNT(b.id)::integer as booking_count,
      COALESCE(SUM(b.net_amount), 0)::numeric(14,2) as net_revenue
    FROM bookings b
    JOIN sport_types s ON b.sport_type_id = s.id
    ${whereSql}
    GROUP BY s.id, s.name
    ORDER BY net_revenue DESC
  `;

  const [summaryRes, facilityRes, sportRes] = await Promise.all([
    pool.query(summaryQuery, queryParams),
    pool.query(facilityBreakdownQuery, queryParams),
    pool.query(sportBreakdownQuery, queryParams),
  ]);

  return {
    kpis: summaryRes.rows[0],
    byFacility: facilityRes.rows,
    bySport: sportRes.rows,
  };
}

async function getBookingsList({ startDate, endDate, facilityId, sportTypeId, limit = 50, offset = 0 }) {
  let whereClauses = [];
  let queryParams = [];
  let paramIdx = 1;

  if (startDate) {
    whereClauses.push(`b.booking_date >= $${paramIdx++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`b.booking_date <= $${paramIdx++}`);
    queryParams.push(endDate);
  }
  if (facilityId) {
    whereClauses.push(`b.facility_id = $${paramIdx++}`);
    queryParams.push(facilityId);
  }
  if (sportTypeId) {
    whereClauses.push(`b.sport_type_id = $${paramIdx++}`);
    queryParams.push(sportTypeId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const listQuery = `
    SELECT 
      b.id,
      f.code as facility_code,
      f.name as facility_name,
      s.name as sport_name,
      b.booking_date,
      b.time_slot_raw,
      b.duration_hours,
      b.customer_name,
      b.gross_amount,
      b.discount_amount,
      b.net_amount,
      pm.name as payment_method,
      b.bank_bin,
      b.status
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN sport_types s ON b.sport_type_id = s.id
    LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
    ${whereSql}
    ORDER BY b.booking_date DESC, b.id DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  queryParams.push(limit, offset);

  const countQuery = `
    SELECT COUNT(*)::integer as total_count
    FROM bookings b
    ${whereSql}
  `;

  const [listRes, countRes] = await Promise.all([
    pool.query(listQuery, queryParams),
    pool.query(countQuery, queryParams.slice(0, paramIdx - 3)),
  ]);

  return {
    total: countRes.rows[0].total_count,
    bookings: listRes.rows,
  };
}

module.exports = {
  getBookingSummary,
  getBookingsList,
};
