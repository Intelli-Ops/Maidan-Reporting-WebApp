const pool = require('../db/pool');

async function getExpenseSummary({ startDate, endDate, facilityId, categoryId }) {
  let whereClauses = [];
  let queryParams = [];
  let paramIdx = 1;

  if (startDate) {
    whereClauses.push(`e.expense_date >= $${paramIdx++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`e.expense_date <= $${paramIdx++}`);
    queryParams.push(endDate);
  }
  if (facilityId) {
    whereClauses.push(`e.facility_id = $${paramIdx++}`);
    queryParams.push(facilityId);
  }
  if (categoryId) {
    whereClauses.push(`e.expense_category_id = $${paramIdx++}`);
    queryParams.push(categoryId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalQuery = `
    SELECT 
      COUNT(*)::integer as total_records,
      COALESCE(SUM(e.amount), 0)::numeric(14,2) as total_expenses
    FROM expenses e
    ${whereSql}
  `;

  const categoryBreakdownQuery = `
    SELECT 
      c.id as category_id,
      c.name as category_name,
      COUNT(e.id)::integer as expense_count,
      COALESCE(SUM(e.amount), 0)::numeric(14,2) as total_amount
    FROM expenses e
    JOIN expense_categories c ON e.expense_category_id = c.id
    ${whereSql}
    GROUP BY c.id, c.name
    ORDER BY total_amount DESC
  `;

  const facilityBreakdownQuery = `
    SELECT 
      f.id as facility_id,
      f.code as facility_code,
      f.name as facility_name,
      COUNT(e.id)::integer as expense_count,
      COALESCE(SUM(e.amount), 0)::numeric(14,2) as total_amount
    FROM expenses e
    JOIN facilities f ON e.facility_id = f.id
    ${whereSql}
    GROUP BY f.id, f.code, f.name
    ORDER BY total_amount DESC
  `;

  const [totalRes, categoryRes, facilityRes] = await Promise.all([
    pool.query(totalQuery, queryParams),
    pool.query(categoryBreakdownQuery, queryParams),
    pool.query(facilityBreakdownQuery, queryParams),
  ]);

  return {
    kpis: totalRes.rows[0],
    byCategory: categoryRes.rows,
    byFacility: facilityRes.rows,
  };
}

async function getExpensesList({ startDate, endDate, facilityId, categoryId, limit = 50, offset = 0 }) {
  let whereClauses = [];
  let queryParams = [];
  let paramIdx = 1;

  if (startDate) {
    whereClauses.push(`e.expense_date >= $${paramIdx++}`);
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`e.expense_date <= $${paramIdx++}`);
    queryParams.push(endDate);
  }
  if (facilityId) {
    whereClauses.push(`e.facility_id = $${paramIdx++}`);
    queryParams.push(facilityId);
  }
  if (categoryId) {
    whereClauses.push(`e.expense_category_id = $${paramIdx++}`);
    queryParams.push(categoryId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const listQuery = `
    SELECT 
      e.id,
      f.code as facility_code,
      f.name as facility_name,
      c.name as category_name,
      e.expense_date,
      e.item,
      e.description,
      e.amount,
      pm.name as payment_method,
      e.cheque_number,
      e.source_bank
    FROM expenses e
    JOIN facilities f ON e.facility_id = f.id
    JOIN expense_categories c ON e.expense_category_id = c.id
    LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
    ${whereSql}
    ORDER BY e.expense_date DESC, e.id DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  queryParams.push(limit, offset);

  const countQuery = `
    SELECT COUNT(*)::integer as total_count
    FROM expenses e
    ${whereSql}
  `;

  const [listRes, countRes] = await Promise.all([
    pool.query(listQuery, queryParams),
    pool.query(countQuery, queryParams.slice(0, paramIdx - 3)),
  ]);

  return {
    total: countRes.rows[0].total_count,
    expenses: listRes.rows,
  };
}

module.exports = {
  getExpenseSummary,
  getExpensesList,
};
