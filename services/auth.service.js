const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

// The OTP itself is emailed (proof the requester controls the inbox), so a
// deterministic SHA-256 hash is safe to use for the DB lookup — unlike a user
// password, there's no need for bcrypt's per-hash salt/cost here, and SHA-256
// lets us query by exact match instead of comparing against every stored
// hash. 10 minutes is short deliberately — it's a 6-digit code, not a
// high-entropy token, so a tighter window plus forgotPasswordLimiter's
// attempt cap is what keeps it safe from guessing.
const RESET_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function findUserByEmail(email) {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, role, status, can_upload, can_use_ai_chat, is_active, is_system_admin, created_at, token_version
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createUser({ email, password, fullName, phone = null, role = null, status = 'pending', canUpload = false, canUseAiChat = false }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, status, can_upload, can_use_ai_chat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, full_name, phone, role, status, can_upload, can_use_ai_chat, is_active, created_at`,
    [email.toLowerCase().trim(), passwordHash, fullName.trim(), phone, role, status, canUpload, canUseAiChat]
  );

  return result.rows[0];
}

// Internal-use fetch that includes password_hash — for verifying a user's
// current password (e.g. change-password). Never expose this row directly
// in a response; findUserById's projection is the public-safe one for that.
async function findUserWithPasswordHashById(id) {
  const result = await pool.query(`SELECT id, password_hash FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function verifyPassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}

// A bcrypt hash of a fixed, unused placeholder — never a real password. Used
// to keep the "no such user" branch of login on a comparable time budget to
// the "wrong password" branch (which runs a real bcrypt.compare), so the
// response-time difference can't be used to test whether an email is
// registered, on top of the identical response body/status already used for
// that purpose.
const DUMMY_PASSWORD_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO/xtBFVFHXPZKgQ3JWJqQmzq5Hq5Nzoi';

async function verifyPasswordTimingSafe(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash || DUMMY_PASSWORD_HASH);
}

async function findPendingUsers() {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, status, created_at
     FROM users
     WHERE status = 'pending'
     ORDER BY created_at ASC`
  );
  return result.rows;
}

async function approveUser({ id, role, canUpload = false, canUseAiChat = false, approvedByUserId }) {
  const result = await pool.query(
    `UPDATE users
     SET role = $1, status = 'approved', is_active = true, can_upload = $2, can_use_ai_chat = $3,
         approved_by = $4, approved_at = now(), updated_at = now()
     WHERE id = $5 AND status = 'pending'
     RETURNING id, email, full_name, phone, role, status, can_upload, can_use_ai_chat, is_active`,
    [role, canUpload, canUseAiChat, approvedByUserId, id]
  );
  return result.rows[0] || null;
}

async function rejectUser({ id, reason, approvedByUserId }) {
  const result = await pool.query(
    `UPDATE users
     SET status = 'rejected', rejected_reason = $1,
         approved_by = $2, approved_at = now(), updated_at = now()
     WHERE id = $3 AND status = 'pending'
     RETURNING id, email, full_name, status`,
    [reason, approvedByUserId, id]
  );
  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Forgot / reset password
// Identity is proven by emailing a 6-digit OTP to the address on file and
// requiring it back — possession of the inbox, not just knowledge of a fact
// about the account. See schema_update_v6 for the columns (reused as-is;
// they're plain TEXT/TIMESTAMPTZ, indifferent to whether they hold a long
// hex hash or a 6-digit OTP hash).
// ---------------------------------------------------------------------------

// Generates a 6-digit OTP, stores only its SHA-256 hash + a 10-minute expiry,
// and returns the raw OTP (this is the only place the raw value ever exists —
// the caller is responsible for emailing it).
async function setResetOtp(userId) {
  const rawOtp = generateOtp();
  const otpHash = hashResetToken(rawOtp);
  const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);

  await pool.query(
    `UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now() WHERE id = $3`,
    [otpHash, expiresAt, userId]
  );

  return { rawOtp, expiresAt };
}

// Looks up a user by email + raw OTP, only if it hasn't expired. Scoped by
// email (not just the hash) because unlike the old 32-byte token, a 6-digit
// OTP only has a million possible values — cheap insurance against two
// outstanding OTPs for different accounts ever coinciding.
async function findUserByResetOtp(email, rawOtp) {
  const otpHash = hashResetToken(rawOtp);
  const result = await pool.query(
    `SELECT id, email, full_name, reset_token_expires_at
     FROM users
     WHERE email = $1 AND reset_token_hash = $2 AND reset_token_expires_at > now()`,
    [email.toLowerCase().trim(), otpHash]
  );
  return result.rows[0] || null;
}

// Sets a new password, invalidates the reset token (single-use), and bumps
// token_version so any JWT issued before this point — including one an
// attacker might hold — stops verifying immediately rather than staying
// valid until its natural expiry.
async function resetPassword({ userId, newPassword }) {
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
  await pool.query(
    `UPDATE users
     SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL,
         token_version = token_version + 1, updated_at = now()
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

// Self-service password change for a logged-in user (current password
// already verified by the caller). Also bumps token_version — see
// resetPassword above for why.
async function changePassword({ userId, newPassword }) {
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
  await pool.query(
    `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = now() WHERE id = $2`,
    [passwordHash, userId]
  );
}

// Called on a wrong-password login attempt. Locks the account for 15
// minutes after 10 failures — the same threshold and window as
// loginLimiter's per-IP cap, so the two controls read as one consistent
// policy rather than two arbitrary numbers. This is layered on top of, not
// instead of, the IP-based limiter: that one alone doesn't slow an attacker
// spreading guesses across many source IPs against a single known account.
async function recordFailedLogin(userId) {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 10 THEN now() + interval '15 minutes'
           ELSE locked_until
         END,
         updated_at = now()
     WHERE id = $1`,
    [userId]
  );
}

// Called on a successful login — clears any accumulated failed-attempt
// count so a legitimate user who mistyped their password a few times isn't
// left one attempt away from a lockout on their next visit.
async function clearFailedLogins(userId) {
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1`,
    [userId]
  );
}

// ---------------------------------------------------------------------------
// Admin user management (beyond initial approval)
// ---------------------------------------------------------------------------

async function findAllUsers() {
  const result = await pool.query(
    `SELECT id, email, full_name, phone, role, status, can_upload, can_use_ai_chat, is_active, is_system_admin, created_at, approved_at
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows;
}

// Edits an already-approved user's role/upload-rights/AI-chat-rights/active
// status. Only touches the fields actually passed in (undefined = leave
// unchanged), so a caller can flip just `isActive` without having to re-send
// everything else.
async function updateUser({ id, role, canUpload, canUseAiChat, isActive }) {
  const result = await pool.query(
    `UPDATE users
     SET role            = COALESCE($1, role),
         can_upload      = COALESCE($2, can_upload),
         can_use_ai_chat = COALESCE($3, can_use_ai_chat),
         is_active       = COALESCE($4, is_active),
         updated_at      = now()
     WHERE id = $5 AND status = 'approved'
     RETURNING id, email, full_name, phone, role, status, can_upload, can_use_ai_chat, is_active, is_system_admin`,
    [role ?? null, canUpload ?? null, canUseAiChat ?? null, isActive ?? null, id]
  );
  return result.rows[0] || null;
}

// Permanently removes an account. Left to the DB's own FK constraint (no ON
// DELETE clause on users.approved_by) to reject deleting a user who's on
// record as having approved other registrations — the controller catches
// that violation (code 23503) and turns it into a clear error message.
async function deleteUser(id) {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserWithPasswordHashById,
  createUser,
  verifyPassword,
  verifyPasswordTimingSafe,
  findPendingUsers,
  approveUser,
  rejectUser,
  setResetOtp,
  findUserByResetOtp,
  resetPassword,
  changePassword,
  recordFailedLogin,
  clearFailedLogins,
  findAllUsers,
  updateUser,
  deleteUser,
};
