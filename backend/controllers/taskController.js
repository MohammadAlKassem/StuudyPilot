const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const {
  requiredString,
  optionalString,
  enumValue,
  positiveIntegerId,
  optionalDate,
  ensureOnlyFields,
} = require('../utils/validation');
const { sendSuccess, sendList } = require('../utils/response');

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'completed'];
const TASK_FIELDS = ['title', 'description', 'deadline', 'priority', 'status'];

const TASK_SELECT = `SELECT
  t.id,
  t.course_id AS courseId,
  t.title,
  t.description,
  t.deadline,
  t.priority,
  t.status,
  t.created_at AS createdAt,
  t.updated_at AS updatedAt
FROM dbo.tasks AS t
INNER JOIN dbo.courses AS c ON t.course_id = c.id`;

function mapTask(task) {
  return {
    ...task,
    id: Number(task.id),
    courseId: Number(task.courseId),
  };
}

async function requireOwnedCourse(courseId, userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, userId)
    .query(`
      SELECT id
      FROM dbo.courses
      WHERE id = @courseId AND user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Course not found', 404, 'NOT_FOUND');
  }
}

async function findOwnedTask(taskId, userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, userId)
    .query(`
      ${TASK_SELECT}
      WHERE t.id = @taskId AND c.user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  return mapTask(result.recordset[0]);
}

async function getCourseTasks(req, res) {
  const courseId = positiveIntegerId(req.params.courseId, 'Course ID');
  await requireOwnedCourse(courseId, req.user.id);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      ${TASK_SELECT}
      WHERE t.course_id = @courseId AND c.user_id = @userId
      ORDER BY
        CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END,
        CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END,
        t.deadline ASC,
        t.created_at DESC,
        t.id DESC;
    `);

  return sendList(res, result.recordset.map(mapTask));
}

async function createTask(req, res) {
  const courseId = positiveIntegerId(req.params.courseId, 'Course ID');
  ensureOnlyFields(req.body, TASK_FIELDS);

  const title = requiredString(req.body.title, 'Title', { max: 150 });
  const description = optionalString(req.body.description, 'Description', { max: 65535 });
  const deadline = optionalDate(req.body.deadline, 'Deadline');
  const priority = enumValue(req.body.priority, 'Priority', PRIORITIES, {
    defaultValue: 'medium',
  });
  const status = enumValue(req.body.status, 'Status', STATUSES, {
    defaultValue: 'pending',
  });

  await requireOwnedCourse(courseId, req.user.id);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('title', sql.NVarChar(150), title)
    .input(
      'description',
      sql.NVarChar(sql.MAX),
      description === undefined ? null : description,
    )
    .input('deadline', sql.DateTime2, deadline)
    .input('priority', sql.VarChar(20), priority)
    .input('status', sql.VarChar(20), status)
    .query(`
      INSERT INTO dbo.tasks
        (course_id, title, description, deadline, priority, status)
      OUTPUT INSERTED.id
      VALUES (@courseId, @title, @description, @deadline, @priority, @status);
    `);

  const task = await findOwnedTask(Number(result.recordset[0].id), req.user.id);
  return sendSuccess(res, 201, 'Task created successfully', task);
}

async function getTask(req, res) {
  const taskId = positiveIntegerId(req.params.id, 'Task ID');
  const task = await findOwnedTask(taskId, req.user.id);
  return sendSuccess(res, 200, null, task);
}

async function updateTask(req, res) {
  const taskId = positiveIntegerId(req.params.id, 'Task ID');
  ensureOnlyFields(req.body, TASK_FIELDS);

  const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body, field);
  const providedFields = TASK_FIELDS.filter(hasField);

  if (providedFields.length === 0) {
    throw new AppError('At least one task field is required', 400, 'VALIDATION_ERROR');
  }

  const changes = {};
  if (hasField('title')) {
    changes.title = requiredString(req.body.title, 'Title', { max: 150 });
  }
  if (hasField('description')) {
    changes.description = optionalString(req.body.description, 'Description', { max: 65535 });
  }
  if (hasField('deadline')) {
    changes.deadline = optionalDate(req.body.deadline, 'Deadline');
  }
  if (hasField('priority')) {
    changes.priority = enumValue(req.body.priority, 'Priority', PRIORITIES);
  }
  if (hasField('status')) {
    changes.status = enumValue(req.body.status, 'Status', STATUSES);
  }

  // Ownership must be established through courses because tasks have no user_id.
  const currentTask = await findOwnedTask(taskId, req.user.id);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('title', sql.NVarChar(150), hasField('title') ? changes.title : currentTask.title)
    .input(
      'description',
      sql.NVarChar(sql.MAX),
      hasField('description') ? changes.description : currentTask.description,
    )
    .input(
      'deadline',
      sql.DateTime2,
      hasField('deadline') ? changes.deadline : currentTask.deadline,
    )
    .input(
      'priority',
      sql.VarChar(20),
      hasField('priority') ? changes.priority : currentTask.priority,
    )
    .input(
      'status',
      sql.VarChar(20),
      hasField('status') ? changes.status : currentTask.status,
    )
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      UPDATE t
      SET
        title = @title,
        description = @description,
        deadline = @deadline,
        priority = @priority,
        status = @status,
        updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.id
      FROM dbo.tasks AS t
      INNER JOIN dbo.courses AS c ON c.id = t.course_id
      WHERE t.id = @taskId AND c.user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  const task = await findOwnedTask(taskId, req.user.id);
  return sendSuccess(res, 200, 'Task updated successfully', task);
}

async function deleteTask(req, res) {
  const taskId = positiveIntegerId(req.params.id, 'Task ID');

  const pool = await getPool();
  const result = await pool
    .request()
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      DELETE t
      OUTPUT DELETED.id
      FROM dbo.tasks AS t
      INNER JOIN dbo.courses AS c ON c.id = t.course_id
      WHERE t.id = @taskId AND c.user_id = @userId;
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Task not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Task deleted successfully');
}

module.exports = {
  getCourseTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
};
