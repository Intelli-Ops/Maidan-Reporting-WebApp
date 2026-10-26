require('dotenv').config();
const pool = require('../db/pool');
const authService = require('../services/auth.service');

async function seedAdmin() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('❌ DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set in the environment. Refusing to seed with no credentials.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('Ensuring users table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id                SERIAL PRIMARY KEY,
          email             TEXT NOT NULL UNIQUE,
          password_hash     TEXT NOT NULL,
          full_name         TEXT NOT NULL,
          phone             TEXT,
          role              TEXT CHECK (role IS NULL OR role IN ('admin','operations_manager','viewer')),
          status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
          approved_by       INTEGER REFERENCES users(id),
          approved_at       TIMESTAMPTZ,
          rejected_reason   TEXT,
          can_upload        BOOLEAN NOT NULL DEFAULT false,
          is_active         BOOLEAN NOT NULL DEFAULT true,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          CHECK (status <> 'approved' OR role IS NOT NULL)
      );
    `);

    const adminName = 'System Admin';

    const existingAdmin = await authService.findUserByEmail(adminEmail);
    if (existingAdmin) {
      console.log(`ℹ️ Admin user (${adminEmail}) already exists.`);
    } else {
      const user = await authService.createUser({
        email: adminEmail,
        password: adminPassword,
        fullName: adminName,
        role: 'admin',
        status: 'approved',
        canUpload: true,
      });
      console.log('✅ Admin user created successfully!');
      console.log(`   Email: ${user.email}`);
      console.log('   Role: admin');
      console.log('   Password: the value you set for DEFAULT_ADMIN_PASSWORD — not echoed here, since this output can end up in CI/deploy logs.');
    }
  } catch (err) {
    console.error('❌ Error seeding admin user:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
