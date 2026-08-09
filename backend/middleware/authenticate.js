const jwt = require('jsonwebtoken');

const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');

async function authenticate(req, _res, next) {
  const authorization = req.get('authorization');
  const match = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+(\S+)$/i)
    : null;

  if (!match) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
  }

  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET);
  } catch (_error) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  if (!decoded || !decoded.id) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, decoded.id)
    .query(`
      SELECT id, name, email, role, is_active AS isActive
      FROM dbo.users
      WHERE id = @userId;
    `);

  const user = result.recordset[0];
  if (!user) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive', 403, 'ACCOUNT_INACTIVE');
  }

  req.user = {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: true,
  };

  return next();
}

module.exports = authenticate;
