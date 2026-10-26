const pool = require('../db/pool');

async function getAllCategories() {
  const result = await pool.query(
    'SELECT id, name, parent_category_id FROM expense_categories ORDER BY parent_category_id NULLS FIRST, id ASC'
  );
  return result.rows;
}

module.exports = {
  getAllCategories,
};
