const { after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-24-characters';

const databasePath = require.resolve('../config/database');
const authenticatePath = require.resolve('../middleware/authenticate');
const realDatabase = require(databasePath);

let databaseRows = [];
let databaseCalls = [];

function createFakeRequest() {
  const inputs = [];
  return {
    input(name, type, value) {
      inputs.push({ name, type, value });
      return this;
    },
    async query(queryText) {
      databaseCalls.push({ inputs, queryText });
      return { recordset: databaseRows };
    },
  };
}

const fakePool = {
  request: createFakeRequest,
};

require.cache[databasePath].exports = {
  ...realDatabase,
  getPool: async () => fakePool,
};
delete require.cache[authenticatePath];

const authenticate = require('../middleware/authenticate');
const AppError = require('../utils/AppError');

function requestWithAuthorization(value) {
  return {
    get(name) {
      return name.toLowerCase() === 'authorization' ? value : undefined;
    },
  };
}

function assertAuthenticationError(expectedStatus, expectedCode) {
  return (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, expectedStatus);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

beforeEach(() => {
  databaseRows = [];
  databaseCalls = [];
});

after(async () => {
  require.cache[databasePath].exports = realDatabase;
  delete require.cache[authenticatePath];
  await realDatabase.closePool();
});

test('authenticate rejects a missing or malformed bearer token', async () => {
  await assert.rejects(
    authenticate(requestWithAuthorization(undefined), {}, () => {}),
    assertAuthenticationError(401, 'AUTHENTICATION_REQUIRED'),
  );
  await assert.rejects(
    authenticate(requestWithAuthorization('Basic abc'), {}, () => {}),
    assertAuthenticationError(401, 'AUTHENTICATION_REQUIRED'),
  );
  assert.equal(databaseCalls.length, 0);
});

test('authenticate rejects an invalid JWT', async () => {
  await assert.rejects(
    authenticate(requestWithAuthorization('Bearer invalid-token'), {}, () => {}),
    assertAuthenticationError(401, 'INVALID_TOKEN'),
  );
  assert.equal(databaseCalls.length, 0);
});

test('authenticate uses a named SQL Server parameter and current database role', async () => {
  databaseRows = [{
    id: '7',
    name: 'Current Student',
    email: 'student@example.com',
    role: 'student',
    isActive: true,
  }];

  const token = jwt.sign(
    { id: 7, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  const req = requestWithAuthorization(`Bearer ${token}`);
  let nextCalls = 0;

  await authenticate(req, {}, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.deepEqual(req.user, {
    id: 7,
    name: 'Current Student',
    email: 'student@example.com',
    role: 'student',
    isActive: true,
  });
  assert.equal(databaseCalls.length, 1);
  assert.match(databaseCalls[0].queryText, /FROM dbo\.users/);
  assert.match(databaseCalls[0].queryText, /WHERE id = @userId/);
  assert.equal(databaseCalls[0].queryText.includes('?'), false);
  assert.deepEqual(
    databaseCalls[0].inputs.map(({ name, value }) => ({ name, value })),
    [{ name: 'userId', value: 7 }],
  );
});

test('authenticate rejects a token after its user is deactivated', async () => {
  databaseRows = [{
    id: '7',
    name: 'Inactive Student',
    email: 'student@example.com',
    role: 'student',
    isActive: false,
  }];

  const token = jwt.sign(
    { id: 7, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  await assert.rejects(
    authenticate(requestWithAuthorization(`Bearer ${token}`), {}, () => {}),
    assertAuthenticationError(403, 'ACCOUNT_INACTIVE'),
  );
});

test('authenticate rejects a valid token whose user record no longer exists', async () => {
  databaseRows = [];
  const token = jwt.sign(
    { id: 99, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );

  await assert.rejects(
    authenticate(requestWithAuthorization(`Bearer ${token}`), {}, () => {}),
    assertAuthenticationError(401, 'INVALID_TOKEN'),
  );
});
