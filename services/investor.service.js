const pool = require('../db/pool');

async function getAllInvestors() {
  const result = await pool.query('SELECT id, name, contact_info FROM investors ORDER BY name ASC');
  return result.rows;
}

module.exports = {
  getAllInvestors,
};
