// set_system_admin.js
//
// Designates one account as the system administrator and (re)sets its login
// details. This is the ONLY way is_system_admin is ever written — see
// sql/schema_update_v16_system_admin.sql for why no API path can set it.
//
// Everything it needs comes from environment variables, so no address or
// password is ever typed on a command line (shell history), passed as an
// argument (visible in the process list), or committed:
//
//   SYSTEM_ADMIN_EMAIL          the login address the account should end up with
//   SYSTEM_ADMIN_PASSWORD       the new password (hashed here, never stored raw)
//   SYSTEM_ADMIN_CURRENT_EMAIL  optional — the address the row has TODAY, if the
//                               address is changing. Defaults to SYSTEM_ADMIN_EMAIL.
//   SYSTEM_ADMIN_NAME           optional — display name. Defaults to 'System Admin'.
//
// Usage:
//   node scripts/set_system_admin.js --dry-run     # report what would change
//   node scripts/set_system_admin.js               # apply to DATABASE_URL
//   node scripts/set_system_admin.js --prod        # apply to PROD_DATABASE_URL
//
// Run it once per database. Nothing about it is automatic: Render runs
// `node server.js` on deploy and never touches migrations or data, so pushing
// this file changes no account anywhere until it is run deliberately.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const config = require('../config');

const DRY_RUN = process.argv.includes('--dry-run');
const PROD = process.argv.includes('--prod');

// Long enough that the account isn't the weak point in a system that already
// bothers with bcrypt, per-account lockout and token versioning.
const MIN_PASSWORD_LENGTH = 12;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const email = (process.env.SYSTEM_ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.SYSTEM_ADMIN_PASSWORD || '';
  const currentEmail = (process.env.SYSTEM_ADMIN_CURRENT_EMAIL || email).toLowerCase().trim();
  const fullName = (process.env.SYSTEM_ADMIN_NAME || 'System Admin').trim();

  if (!email || !password) {
    fail('Set SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD in .env before running this.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`SYSTEM_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const connectionString = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
  if (!connectionString) {
    fail(PROD ? 'Missing PROD_DATABASE_URL.' : 'Missing DATABASE_URL.');
  }
  // The same guard run_schema_on_prod.js uses: --prod pointing at the dev
  // database would silently do the right thing to the wrong place.
  if (PROD && connectionString === process.env.DATABASE_URL) {
    fail('PROD_DATABASE_URL matches DATABASE_URL. Refusing to run.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log(`Target: ${PROD ? 'PRODUCTION' : 'development'} database`);

  try {
    const { rows: cols } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_system_admin'`
    );
    if (cols.length === 0) {
      fail('users.is_system_admin does not exist here. Apply sql/schema_update_v16_system_admin.sql to this database first.');
    }

    const { rows: found } = await client.query(
      `SELECT id, email, full_name, role, status, is_active, is_system_admin
         FROM users WHERE email = $1`,
      [currentEmail]
    );
    if (found.length === 0) {
      fail(`No account found with email ${currentEmail} in this database.`);
    }
    const target = found[0];

    // Only blocked if some OTHER account already holds the new address —
    // re-running with the address already applied is a no-op, not a clash.
    if (email !== currentEmail) {
      const { rows: clash } = await client.query(
        `SELECT id FROM users WHERE email = $1 AND id <> $2`,
        [email, target.id]
      );
      if (clash.length > 0) {
        fail(`Another account (id ${clash[0].id}) already uses ${email}.`);
      }
    }

    console.log(`\nAccount id ${target.id}`);
    console.log(`  email      ${target.email}${email !== target.email ? `  ->  ${email}` : '  (unchanged)'}`);
    console.log(`  name       ${target.full_name}${fullName !== target.full_name ? `  ->  ${fullName}` : '  (unchanged)'}`);
    console.log(`  role       ${target.role}${target.role !== 'admin' ? '  ->  admin' : '  (unchanged)'}`);
    console.log(`  system     ${target.is_system_admin}${target.is_system_admin ? '  (unchanged)' : '  ->  true'}`);
    console.log('  password   will be re-hashed and replaced');

    if (DRY_RUN) {
      console.log('\nDRY RUN — nothing was written.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

    await client.query('BEGIN');

    // Clear the flag from anyone else first. The partial unique index allows
    // one holder, so without this a handover would fail on the constraint
    // rather than moving the designation.
    await client.query(
      `UPDATE users SET is_system_admin = false, updated_at = now()
        WHERE is_system_admin AND id <> $1`,
      [target.id]
    );

    // token_version is bumped for the same reason resetPassword bumps it: any
    // JWT minted before this point stops verifying immediately instead of
    // staying valid until its natural expiry. Reset state and the failed-login
    // counter are cleared so an outstanding OTP or an active lockout doesn't
    // survive the change.
    const { rows: updated } = await client.query(
      `UPDATE users
          SET email                  = $1,
              full_name              = $2,
              password_hash          = $3,
              role                   = 'admin',
              status                 = 'approved',
              is_active              = true,
              is_system_admin        = true,
              reset_token_hash       = NULL,
              reset_token_expires_at = NULL,
              failed_login_attempts  = 0,
              locked_until           = NULL,
              token_version          = token_version + 1,
              updated_at             = now()
        WHERE id = $4
        RETURNING id, email, full_name, role, is_system_admin`,
      [email, fullName, passwordHash, target.id]
    );

    await client.query('COMMIT');

    const row = updated[0];
    console.log(`\nDone. id ${row.id} — ${row.full_name} <${row.email}>, role ${row.role}, system administrator.`);
    console.log('The password is not echoed here; this output can end up in a terminal log.');
    console.log('Any session that was signed in as this account is now signed out.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Nothing to roll back if the failure happened before BEGIN.
    }
    console.error('\nFailed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
