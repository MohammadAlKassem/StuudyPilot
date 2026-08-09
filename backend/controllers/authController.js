const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const {
  ensureOnlyFields,
  normalizeEmail,
  requiredString,
} = require('../utils/validation');
const { sendSuccess } = require('../utils/response');

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72;
const BCRYPT_ROUNDS = 10;

function requirePassword(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('Password is required', 400, 'VALIDATION_ERROR');
  }

  return value;
}

function validateRegistrationPassword(value) {
  const password = requirePassword(value);

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters long`,
      400,
      'VALIDATION_ERROR',
    );
  }

  return password;
}

function toSafeUser(user) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.isActive),
  };
}

function isDuplicateKeyError(error) {
  const errorNumbers = [
    error?.number,
    error?.info?.number,
    error?.originalError?.number,
    error?.originalError?.info?.number,
    ...(error?.precedingErrors || []).map((precedingError) => precedingError?.number),
  ].map(Number);

  return errorNumbers.includes(2601) || errorNumbers.includes(2627);
}

async function register(req, res) {
  ensureOnlyFields(req.body, ['name', 'email', 'password']);

  const name = requiredString(req.body.name, 'Name', { min: 2, max: 100 });
  const email = normalizeEmail(req.body.email);
  const password = validateRegistrationPassword(req.body.password);

  const pool = await getPool();
  const existingResult = await pool
    .request()
    .input('email', sql.NVarChar(150), email)
    .query(`
      SELECT id
      FROM dbo.users
      WHERE email = @email;
    `);

  if (existingResult.recordset.length > 0) {
    throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let insertResult;
  try {
    insertResult = await pool
      .request()
      .input('name', sql.NVarChar(100), name)
      .input('email', sql.NVarChar(150), email)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('role', sql.VarChar(20), 'student')
      .query(`
        INSERT INTO dbo.users (name, email, password_hash, role)
        OUTPUT INSERTED.id
        VALUES (@name, @email, @passwordHash, @role);
      `);
  } catch (error) {
    // The unique index remains the final guard if two registrations race.
    if (isDuplicateKeyError(error)) {
      throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
    }
    throw error;
  }

  return sendSuccess(res, 201, 'Registration successful', {
    id: Number(insertResult.recordset[0].id),
    name,
    email,
    role: 'student',
    isActive: true,
  });
}

async function login(req, res) {
  ensureOnlyFields(req.body, ['email', 'password']);

  const email = normalizeEmail(req.body.email);
  const password = requirePassword(req.body.password);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('email', sql.NVarChar(150), email)
    .query(`
      SELECT id, name, email, password_hash AS passwordHash,
             role, is_active AS isActive
      FROM dbo.users
      WHERE email = @email;
    `);

  const user = result.recordset[0];
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive', 403, 'ACCOUNT_INACTIVE');
  }

  const token = jwt.sign(
    { id: Number(user.id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );

  return sendSuccess(res, 200, 'Login successful', {
    token,
    user: toSafeUser(user),
  });
}

async function getMe(req, res) {
  return sendSuccess(res, 200, null, toSafeUser(req.user));
}

module.exports = {
  register,
  login,
  getMe,
};
