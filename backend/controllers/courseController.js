const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const {
  requiredString,
  positiveIntegerId,
  ensureOnlyFields,
} = require('../utils/validation');
const { sendSuccess, sendList } = require('../utils/response');

async function createCourse(req, res) {
  ensureOnlyFields(req.body, ['title']);
  const title = requiredString(req.body.title, 'Title', { max: 100 });

  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, req.user.id)
    .input('title', sql.NVarChar(100), title)
    .query(`
      INSERT INTO dbo.courses (user_id, title)
      OUTPUT INSERTED.id
      VALUES (@userId, @title);
    `);

  return sendSuccess(res, 201, 'Course created successfully', {
    id: Number(result.recordset[0].id),
    title,
  });
}

async function getCourses(req, res) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, req.user.id)
    .query(`
      SELECT
        c.id,
        c.title,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt,
        COUNT(t.id) AS taskCount,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completedTaskCount,
        CASE
          WHEN COUNT(t.id) = 0 THEN 0
          ELSE CAST(ROUND(
            SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END)
            * 100.0 / COUNT(t.id),
            0
          ) AS INT)
        END AS progressPercentage
      FROM dbo.courses AS c
      LEFT JOIN dbo.tasks AS t ON t.course_id = c.id
      WHERE c.user_id = @userId
      GROUP BY c.id, c.title, c.created_at, c.updated_at
      ORDER BY c.created_at DESC, c.id DESC;
    `);

  const courses = result.recordset.map((course) => ({
    ...course,
    id: Number(course.id),
    taskCount: Number(course.taskCount),
    completedTaskCount: Number(course.completedTaskCount),
    progressPercentage: Number(course.progressPercentage),
  }));

  return sendList(res, courses);
}

async function getCourse(req, res) {
  const courseId = positiveIntegerId(req.params.id, 'Course ID');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      SELECT
        id,
        title,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM dbo.courses
      WHERE id = @courseId AND user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Course not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, null, {
    ...result.recordset[0],
    id: Number(result.recordset[0].id),
  });
}

async function updateCourse(req, res) {
  const courseId = positiveIntegerId(req.params.id, 'Course ID');
  ensureOnlyFields(req.body, ['title']);
  const title = requiredString(req.body.title, 'Title', { max: 100 });

  const pool = await getPool();
  const result = await pool
    .request()
    .input('title', sql.NVarChar(100), title)
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      UPDATE dbo.courses
      SET
        title = @title,
        updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.id
      WHERE id = @courseId AND user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Course not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Course updated successfully', {
    id: courseId,
    title,
  });
}

async function deleteCourse(req, res) {
  const courseId = positiveIntegerId(req.params.id, 'Course ID');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      DELETE FROM dbo.courses
      OUTPUT DELETED.id
      WHERE id = @courseId AND user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Course not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Course deleted successfully');
}

module.exports = {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
};
