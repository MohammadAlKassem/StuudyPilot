const { after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../config/database');
const realDatabase = require(databasePath);

let resultQueue = [];
let queryCalls = [];

function createFakeRequest() {
  const inputs = [];
  return {
    input(name, type, value) {
      inputs.push({ name, type, value });
      return this;
    },
    async query(queryText) {
      queryCalls.push({ inputs, queryText });
      const next = resultQueue.shift();
      if (next instanceof Error) throw next;
      return next || { recordset: [], rowsAffected: [0] };
    },
  };
}

const fakePool = { request: createFakeRequest };

require.cache[databasePath].exports = {
  ...realDatabase,
  getPool: async () => fakePool,
};

const controllerPaths = [
  require.resolve('../controllers/authController'),
  require.resolve('../controllers/courseController'),
  require.resolve('../controllers/taskController'),
  require.resolve('../controllers/noteController'),
  require.resolve('../controllers/studyPlanController'),
];
for (const controllerPath of controllerPaths) delete require.cache[controllerPath];

const { register } = require('../controllers/authController');
const { createCourse, getCourse } = require('../controllers/courseController');
const { getTask, deleteTask } = require('../controllers/taskController');
const { deleteNote } = require('../controllers/noteController');
const { deleteStudyPlan } = require('../controllers/studyPlanController');
const AppError = require('../utils/AppError');

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

beforeEach(() => {
  resultQueue = [];
  queryCalls = [];
});

after(async () => {
  require.cache[databasePath].exports = realDatabase;
  for (const controllerPath of controllerPaths) delete require.cache[controllerPath];
  await realDatabase.closePool();
});

test('course creation uses named parameters and OUTPUT INSERTED result handling', async () => {
  resultQueue.push({ recordset: [{ id: '41' }], rowsAffected: [1] });
  const res = responseRecorder();

  await createCourse(
    { user: { id: 7 }, body: { title: 'Web Development' } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.data, { id: 41, title: 'Web Development' });
  assert.equal(queryCalls.length, 1);
  assert.match(queryCalls[0].queryText, /INSERT INTO dbo\.courses/);
  assert.match(queryCalls[0].queryText, /OUTPUT INSERTED\.id/);
  assert.equal(queryCalls[0].queryText.includes('?'), false);
  assert.deepEqual(
    queryCalls[0].inputs.map(({ name, value }) => ({ name, value })),
    [
      { name: 'userId', value: 7 },
      { name: 'title', value: 'Web Development' },
    ],
  );
});

test('an empty owned-course recordset produces a 404', async () => {
  resultQueue.push({ recordset: [], rowsAffected: [] });

  await assert.rejects(
    getCourse({ user: { id: 7 }, params: { id: '99' } }, responseRecorder()),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Course not found');
      return true;
    },
  );

  assert.match(queryCalls[0].queryText, /id = @courseId AND user_id = @userId/);
  assert.deepEqual(
    queryCalls[0].inputs.map(({ name, value }) => ({ name, value })),
    [
      { name: 'courseId', value: 99 },
      { name: 'userId', value: 7 },
    ],
  );
});

test('task ownership failures use the courses join and return 404', async () => {
  resultQueue.push({ recordset: [], rowsAffected: [] });

  await assert.rejects(
    getTask({ user: { id: 7 }, params: { id: '55' } }, responseRecorder()),
    (error) => error instanceof AppError && error.statusCode === 404,
  );

  assert.match(queryCalls[0].queryText, /INNER JOIN dbo\.courses/);
  assert.match(queryCalls[0].queryText, /c\.user_id = @userId/);
  assert.equal(/tasks\.user_id|t\.user_id/.test(queryCalls[0].queryText), false);
});

test('task deletion is one ownership-safe SQL Server DELETE join', async () => {
  resultQueue.push({ recordset: [], rowsAffected: [0] });

  await assert.rejects(
    deleteTask({ user: { id: 7 }, params: { id: '55' } }, responseRecorder()),
    (error) => error instanceof AppError && error.statusCode === 404,
  );

  assert.equal(queryCalls.length, 1);
  assert.match(queryCalls[0].queryText, /DELETE t/);
  assert.match(queryCalls[0].queryText, /OUTPUT DELETED\.id/);
  assert.match(queryCalls[0].queryText, /INNER JOIN dbo\.courses/);
  assert.match(queryCalls[0].queryText, /c\.user_id = @userId/);
});

test('registration reads a SQL Server OUTPUT id and never returns the hash', async () => {
  resultQueue.push(
    { recordset: [], rowsAffected: [] },
    { recordset: [{ id: '88' }], rowsAffected: [1] },
  );
  const res = responseRecorder();

  await register({
    body: {
      name: 'Student Test',
      email: 'Student.Test@Example.com',
      password: 'password123',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, 88);
  assert.equal(res.body.data.email, 'student.test@example.com');
  assert.equal(res.body.data.role, 'student');
  assert.equal('passwordHash' in res.body.data, false);
  assert.equal(queryCalls.length, 2);
  assert.match(queryCalls[1].queryText, /INSERT INTO dbo\.users/);
  assert.match(queryCalls[1].queryText, /OUTPUT INSERTED\.id/);
  assert.match(queryCalls[1].queryText, /@passwordHash/);
});

test('registration maps a SQL Server 2627 race to the specific duplicate-email error', async () => {
  const duplicate = new Error('raw unique constraint details');
  duplicate.number = 2627;
  resultQueue.push({ recordset: [], rowsAffected: [] }, duplicate);

  await assert.rejects(
    register({
      body: {
        name: 'Student Test',
        email: 'student.test@example.com',
        password: 'password123',
      },
    }, responseRecorder()),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'DUPLICATE_EMAIL');
      assert.equal(error.message.includes('raw unique'), false);
      return true;
    },
  );
});

test('note deletion trusts DELETE OUTPUT even when the driver reports zero rowsAffected', async () => {
  resultQueue.push({ recordset: [{ id: '9' }], rowsAffected: [0] });
  const res = responseRecorder();

  await deleteNote({ user: { id: 7 }, params: { id: '9' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Note deleted successfully');
  assert.match(queryCalls[0].queryText, /OUTPUT DELETED\.id/);
});

test('study-plan deletion uses its DELETE OUTPUT recordset for existence', async () => {
  resultQueue.push({ recordset: [{ id: '10' }], rowsAffected: [0] });
  const res = responseRecorder();

  await deleteStudyPlan({ user: { id: 7 }, params: { id: '10' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Study plan deleted successfully');
  assert.match(queryCalls[0].queryText, /OUTPUT DELETED\.id/);
});
