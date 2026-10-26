const pool = require('../db/pool');

async function getAllFacilities() {
  const result = await pool.query('SELECT id, code, name, location FROM facilities ORDER BY id ASC');
  return result.rows;
}

module.exports = {
  getAllFacilities,
};
