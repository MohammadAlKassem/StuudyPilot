'use strict';

const { getPool, sql } = require('../config/database');
const AppError = require('../utils/AppError');
const { sendList, sendSuccess } = require('../utils/response');
const {
  ensureOnlyFields,
  positiveIntegerId,
  requiredString,
} = require('../utils/validation');

const NOTE_FIELDS = `
  id,
  title,
  content,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function mapNote(note) {
  return { ...note, id: Number(note.id) };
}

function validateCreateBody(body) {
  ensureOnlyFields(body, ['title', 'content']);

  return {
    title: requiredString(body.title, 'Title', { max: 150 }),
    content: requiredString(body.content, 'Content', { max: 50000 }),
  };
}

function validateUpdateBody(body) {
  ensureOnlyFields(body, ['title', 'content']);

  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
  const hasContent = Object.prototype.hasOwnProperty.call(body, 'content');

  if (!hasTitle && !hasContent) {
    throw new AppError(
      'At least one of title or content is required',
      400,
      'VALIDATION_ERROR',
    );
  }

  return {
    hasTitle,
    hasContent,
    title: hasTitle
      ? requiredString(body.title, 'Title', { max: 150 })
      : undefined,
    content: hasContent
      ? requiredString(body.content, 'Content', { max: 50000 })
      : undefined,
  };
}

async function createNote(req, res) {
  const { title, content } = validateCreateBody(req.body);
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, req.user.id)
    .input('title', sql.NVarChar(150), title)
    .input('content', sql.NVarChar(sql.MAX), content)
    .query(`
      INSERT INTO dbo.notes (user_id, title, content)
      OUTPUT
        INSERTED.id,
        INSERTED.title,
        INSERTED.content,
        INSERTED.created_at AS createdAt,
        INSERTED.updated_at AS updatedAt
      VALUES (@userId, @title, @content);
    `);

  return sendSuccess(res, 201, 'Note created successfully', mapNote(result.recordset[0]));
}

async function listNotes(req, res) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, req.user.id)
    .query(`
      SELECT ${NOTE_FIELDS}
      FROM dbo.notes
      WHERE user_id = @userId
      ORDER BY created_at DESC, id DESC;
    `);

  return sendList(res, result.recordset.map(mapNote));
}

async function getNote(req, res) {
  const noteId = positiveIntegerId(req.params.id, 'Note ID');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('noteId', sql.Int, noteId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      SELECT ${NOTE_FIELDS}
      FROM dbo.notes
      WHERE id = @noteId AND user_id = @userId;
    `);

  if (!result.recordset.length) {
    throw new AppError('Note not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Note retrieved successfully', mapNote(result.recordset[0]));
}

async function updateNote(req, res) {
  const noteId = positiveIntegerId(req.params.id, 'Note ID');
  const { hasTitle, hasContent, title, content } = validateUpdateBody(req.body);
  const assignments = [];
  const pool = await getPool();
  const request = pool
    .request()
    .input('noteId', sql.Int, noteId)
    .input('userId', sql.Int, req.user.id);

  if (hasTitle) {
    assignments.push('title = @title');
    request.input('title', sql.NVarChar(150), title);
  }
  if (hasContent) {
    assignments.push('content = @content');
    request.input('content', sql.NVarChar(sql.MAX), content);
  }

  assignments.push('updated_at = SYSUTCDATETIME()');
  const result = await request.query(`
    UPDATE dbo.notes
    SET ${assignments.join(', ')}
    OUTPUT
      INSERTED.id,
      INSERTED.title,
      INSERTED.content,
      INSERTED.created_at AS createdAt,
      INSERTED.updated_at AS updatedAt
    WHERE id = @noteId AND user_id = @userId;
  `);

  if (!result.recordset.length) {
    throw new AppError('Note not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Note updated successfully', mapNote(result.recordset[0]));
}

async function deleteNote(req, res) {
  const noteId = positiveIntegerId(req.params.id, 'Note ID');
  const pool = await getPool();
  const result = await pool
    .request()
    .input('noteId', sql.Int, noteId)
    .input('userId', sql.Int, req.user.id)
    .query(`
      DELETE FROM dbo.notes
      OUTPUT DELETED.id
      WHERE id = @noteId AND user_id = @userId;
    `);

  if (!result.recordset.length) {
    throw new AppError('Note not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, 200, 'Note deleted successfully');
}

module.exports = {
  createNote,
  listNotes,
  getNote,
  updateNote,
  deleteNote,
};
