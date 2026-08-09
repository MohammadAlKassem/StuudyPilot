const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { positiveIntegerId, booleanValue, ensureOnlyFields } = require('../utils/validation');
const { sendSuccess, sendList } = require('../utils/response');

function mapUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getStats(req, res) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.users WHERE role = 'student') AS totalStudents,
      (SELECT COUNT(*) FROM dbo.users WHERE role = 'student' AND is_active = 1) AS activeStudents,
      (SELECT COUNT(*) FROM dbo.courses) AS totalCourses,
      (SELECT COUNT(*) FROM dbo.tasks) AS totalTasks,
      (SELECT COUNT(*) FROM dbo.tasks WHERE status = 'completed') AS completedTasks,
      (SELECT COUNT(*) FROM dbo.ai_logs) AS totalAiRequests,
      (SELECT COUNT(*) FROM dbo.ai_logs WHERE status = 'success') AS successfulAiRequests,
      (SELECT COUNT(*) FROM dbo.ai_logs WHERE status = 'failed') AS failedAiRequests;
  `);
  const counts = result.recordset[0];

  return sendSuccess(res, 200, null, {
    totalStudents: Number(counts.totalStudents),
    activeStudents: Number(counts.activeStudents),
    totalCourses: Number(counts.totalCourses),
    totalTasks: Number(counts.totalTasks),
    completedTasks: Number(counts.completedTasks),
    totalAiRequests: Number(counts.totalAiRequests),
    successfulAiRequests: Number(counts.successfulAiRequests),
    failedAiRequests: Number(counts.failedAiRequests),
  });
}

async function getUsers(req, res) {
  const { status } = req.query;
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    throw new AppError('Status must be active or inactive', 400, 'VALIDATION_ERROR');
  }

  const pool = await getPool();
  const request = pool.request();
  let whereClause = '';

  if (status) {
    request.input('isActive', sql.Bit, status === 'active');
    whereClause = 'WHERE is_active = @isActive';
  }

  const result = await request.query(`
    SELECT id, name, email, role, is_active, created_at, updated_at
    FROM dbo.users
    ${whereClause}
    ORDER BY created_at DESC, id DESC;
  `);

  return sendList(res, result.recordset.map(mapUser));
}

async function updateUserStatus(req, res) {
  ensureOnlyFields(req.body, ['isActive']);
  const userId = positiveIntegerId(req.params.id, 'User ID');
  const isActive = booleanValue(req.body.isActive, 'isActive');

  if (userId === req.user.id && !isActive) {
    throw new AppError('Administrators cannot deactivate their own account', 400, 'SELF_DEACTIVATION');
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('isActive', sql.Bit, isActive)
    .query(`
      UPDATE dbo.users
      SET
        is_active = @isActive,
        updated_at = SYSUTCDATETIME()
      OUTPUT
        INSERTED.id,
        INSERTED.name,
        INSERTED.email,
        INSERTED.role,
        INSERTED.is_active,
        INSERTED.created_at,
        INSERTED.updated_at
      WHERE id = @userId;
    `);

  if (!result.recordset.length) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(
    res,
    200,
    `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    mapUser(result.recordset[0]),
  );
}

async function getAiLogs(req, res) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP (50)
      l.id,
      l.user_id,
      u.name AS user_name,
      u.email AS user_email,
      l.status,
      LEFT(l.prompt, 2000) AS prompt,
      l.error_message,
      l.created_at
    FROM dbo.ai_logs AS l
    INNER JOIN dbo.users AS u ON u.id = l.user_id
    ORDER BY l.created_at DESC, l.id DESC;
  `);

  const logs = result.recordset.map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    userName: row.user_name,
    userEmail: row.user_email,
    status: row.status,
    prompt: row.prompt,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));

  return sendList(res, logs);
}

module.exports = {
  getStats,
  getUsers,
  updateUserStatus,
  getAiLogs,
};
