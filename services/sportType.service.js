const pool = require('../db/pool');

async function getAllSportTypes() {
  const result = await pool.query('SELECT id, name FROM sport_types ORDER BY id ASC');
  return result.rows;
}

module.exports = {
  getAllSportTypes,
};
