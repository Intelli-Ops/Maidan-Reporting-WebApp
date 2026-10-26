const pool = require('../db/pool');

// Fire-and-forget by design: a failed audit write must never block or fail
// the admin action it's recording (e.g. a user deletion succeeding is more
// important than the audit row succeeding) — errors are logged, not thrown.
async function record({ actorUserId, action, targetType = null, targetId = null, metadata = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorUserId, action, targetType, targetId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('Failed to write audit log entry:', err);
  }
}

module.exports = { record };
