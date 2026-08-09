const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeError,
  getSqlServerErrorNumber,
} = require('../middleware/errorHandler');

test('SQL Server duplicate-key errors map to a safe 409', () => {
  for (const number of [2601, 2627]) {
    const normalized = normalizeError({ number, message: 'raw SQL details' });
    assert.equal(normalized.statusCode, 409);
    assert.equal(normalized.code, 'DUPLICATE_VALUE');
    assert.equal(normalized.message.includes('raw SQL'), false);
  }
});

test('SQL Server foreign-key and CHECK violations map to a safe 400', () => {
  const normalized = normalizeError({ info: { number: 547 }, message: 'constraint name' });
  assert.equal(normalized.statusCode, 400);
  assert.equal(normalized.code, 'INVALID_RELATION');
  assert.equal(normalized.message.includes('constraint name'), false);
});

test('constraint numbers are found inside preceding SQL Server errors', () => {
  const error = {
    number: 3621,
    precedingErrors: [{ number: 2627 }],
  };
  assert.equal(getSqlServerErrorNumber(error), 2627);
  assert.equal(normalizeError(error).statusCode, 409);
});

test('unexpected driver errors remain generic 500 responses', () => {
  const normalized = normalizeError({ code: 'ESOCKET', message: 'server details' });
  assert.equal(normalized.statusCode, 500);
  assert.equal(normalized.code, 'INTERNAL_ERROR');
  assert.equal(normalized.message, 'An unexpected server error occurred');
});
