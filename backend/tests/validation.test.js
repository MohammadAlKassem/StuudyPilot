const test = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('../utils/AppError');
const {
  booleanValue,
  ensureOnlyFields,
  enumValue,
  integerInRange,
  normalizeEmail,
  optionalDate,
  optionalString,
  positiveIntegerId,
  requiredString,
} = require('../utils/validation');

function assertValidationError(callback) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    return true;
  });
}

test('requiredString trims valid input and enforces type and length', () => {
  assert.equal(
    requiredString('  JavaScript  ', 'Subject', { min: 2, max: 20 }),
    'JavaScript',
  );

  assertValidationError(() => requiredString(undefined, 'Subject'));
  assertValidationError(() => requiredString('   ', 'Subject'));
  assertValidationError(() => requiredString('a', 'Subject', { min: 2 }));
  assertValidationError(() => requiredString('too long', 'Subject', { max: 3 }));
});

test('optionalString handles omitted and nullable values and validates supplied input', () => {
  assert.equal(optionalString(undefined, 'Description'), undefined);
  assert.equal(optionalString(null, 'Description'), null);
  assert.equal(optionalString('  details  ', 'Description'), 'details');

  assertValidationError(() => optionalString(42, 'Description'));
  assertValidationError(() => optionalString('long text', 'Description', { max: 4 }));
  assertValidationError(() => optionalString(null, 'Description', { allowNull: false }));
});

test('normalizeEmail trims and lowercases valid emails and rejects invalid emails', () => {
  assert.equal(normalizeEmail('  Student@Example.COM  '), 'student@example.com');

  assertValidationError(() => normalizeEmail('not-an-email'));
  assertValidationError(() => normalizeEmail('student @example.com'));
  assertValidationError(() => normalizeEmail(undefined));
});

test('enumValue accepts listed values and supports defaults and optional values', () => {
  const priorities = ['low', 'medium', 'high'];

  assert.equal(enumValue('high', 'Priority', priorities), 'high');
  assert.equal(
    enumValue(undefined, 'Priority', priorities, { defaultValue: 'medium' }),
    'medium',
  );
  assert.equal(
    enumValue(undefined, 'Priority', priorities, { optional: true }),
    undefined,
  );

  assertValidationError(() => enumValue('urgent', 'Priority', priorities));
  assertValidationError(() => enumValue(1, 'Priority', priorities));
});

test('positiveIntegerId converts decimal strings and rejects invalid IDs', () => {
  assert.equal(positiveIntegerId('42', 'Course ID'), 42);
  assert.equal(positiveIntegerId(7, 'Course ID'), 7);

  assertValidationError(() => positiveIntegerId(0, 'Course ID'));
  assertValidationError(() => positiveIntegerId(-1, 'Course ID'));
  assertValidationError(() => positiveIntegerId('1.5', 'Course ID'));
  assertValidationError(() => positiveIntegerId('abc', 'Course ID'));
  assertValidationError(() => positiveIntegerId(Number.MAX_SAFE_INTEGER + 1, 'Course ID'));
});

test('optionalDate converts valid dates, accepts omission, and rejects invalid dates', () => {
  assert.equal(optionalDate(undefined), null);
  assert.equal(optionalDate(null), null);
  assert.equal(optionalDate(''), null);

  const parsed = optionalDate('2026-08-12T18:00:00.000Z');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), '2026-08-12T18:00:00.000Z');

  assertValidationError(() => optionalDate('not-a-date'));
  assertValidationError(() => optionalDate('2026-02-30T18:00:00Z'));
  assertValidationError(() => optionalDate(12345));
});

test('integerInRange accepts bounded integers and rejects other numbers', () => {
  assert.equal(integerInRange(15, 'Available minutes', 15, 480), 15);
  assert.equal(integerInRange(480, 'Available minutes', 15, 480), 480);

  assertValidationError(() => integerInRange(14, 'Available minutes', 15, 480));
  assertValidationError(() => integerInRange(481, 'Available minutes', 15, 480));
  assertValidationError(() => integerInRange(90.5, 'Available minutes', 15, 480));
  assertValidationError(() => integerInRange('90', 'Available minutes', 15, 480));
});

test('booleanValue accepts only actual booleans', () => {
  assert.equal(booleanValue(true, 'Active status'), true);
  assert.equal(booleanValue(false, 'Active status'), false);

  assertValidationError(() => booleanValue(1, 'Active status'));
  assertValidationError(() => booleanValue('false', 'Active status'));
});

test('ensureOnlyFields accepts allowed object keys and rejects unsafe bodies', () => {
  assert.equal(
    ensureOnlyFields({ title: 'Exam reminder', content: 'Review' }, ['title', 'content']),
    undefined,
  );

  assertValidationError(() => ensureOnlyFields({ title: 'Course', user_id: 99 }, ['title']));
  assertValidationError(() => ensureOnlyFields(null, ['title']));
  assertValidationError(() => ensureOnlyFields([], ['title']));
});
