const pool = require('../db/pool');

async function getAllPaymentMethods() {
  const result = await pool.query('SELECT id, name FROM payment_methods ORDER BY id ASC');
  return result.rows;
}

module.exports = {
  getAllPaymentMethods,
};
