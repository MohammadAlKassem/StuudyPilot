const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const {
  getPool,
  closePool,
  validateDatabaseConfig,
  sql,
} = require('../config/database');
const { rejectTemplateAdminCredentials } = require('../config/security');
const { requiredString, normalizeEmail } = require('../utils/validation');

async function createAdmin() {
  validateDatabaseConfig();

  const name = requiredString(process.env.ADMIN_NAME, 'ADMIN_NAME', { min: 2, max: 100 });
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;

  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD must be between 6 and 72 characters');
  }

  rejectTemplateAdminCredentials(email, password);

  const pool = await getPool();
  const existingResult = await pool
    .request()
    .input('email', sql.NVarChar(150), email)
    .query(`
      SELECT TOP (1)
        id,
        role
      FROM dbo.users
      WHERE email = @email;
    `);

  const existingUser = existingResult.recordset[0];
  if (existingUser) {
    if (existingUser.role === 'admin') {
      console.log(`Administrator ${email} already exists; no duplicate was created.`);
      return Number(existingUser.id);
    }
    throw new Error(`The email ${email} already belongs to a student; it was not promoted.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const insertResult = await pool
    .request()
    .input('name', sql.NVarChar(100), name)
    .input('email', sql.NVarChar(150), email)
    .input('passwordHash', sql.NVarChar(255), passwordHash)
    .query(`
      INSERT INTO dbo.users
      (
        name,
        email,
        password_hash,
        role,
        is_active
      )
      OUTPUT INSERTED.id
      VALUES
      (
        @name,
        @email,
        @passwordHash,
        'admin',
        1
      );
    `);

  const adminId = Number(insertResult.recordset[0].id);
  console.log(`Administrator ${email} created successfully.`);
  return adminId;
}

createAdmin()
  .catch((error) => {
    console.error(`Could not create administrator: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      console.error('Could not close the SQL Server connection pool.');
      process.exitCode = 1;
    }
  });
