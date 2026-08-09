const test = require('node:test');
const assert = require('node:assert/strict');

const authorize = require('../middleware/authorize');
const AppError = require('../utils/AppError');

function assertForbidden(callback) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(error.message, 'You do not have permission to perform this action');
    return true;
  });
}

test('authorize calls next for an allowed role', () => {
  const middleware = authorize('admin');
  let nextCalls = 0;

  middleware({ user: { id: 1, role: 'admin' } }, {}, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
});

test('authorize supports more than one allowed role', () => {
  const middleware = authorize('student', 'admin');
  let nextCalls = 0;

  middleware({ user: { id: 2, role: 'student' } }, {}, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
});

test('authorize throws a 403 AppError for a disallowed role', () => {
  const middleware = authorize('admin');
  let nextCalled = false;

  assertForbidden(() => middleware(
    { user: { id: 2, role: 'student' } },
    {},
    () => { nextCalled = true; },
  ));

  assert.equal(nextCalled, false);
});

test('authorize defensively rejects a request without an authenticated user', () => {
  const middleware = authorize('student');
  let nextCalled = false;

  assertForbidden(() => middleware(
    {},
    {},
    () => { nextCalled = true; },
  ));

  assert.equal(nextCalled, false);
});
