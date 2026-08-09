const test = require('node:test');
const assert = require('node:assert/strict');

const {
  rejectTemplateJwtSecret,
  rejectTemplateAdminCredentials,
} = require('../config/security');

test('JWT security validation rejects the public template placeholder', () => {
  assert.throws(
    () => rejectTemplateJwtSecret('replace_with_a_long_random_secret'),
    /JWT_SECRET must be replaced/,
  );
  assert.doesNotThrow(
    () => rejectTemplateJwtSecret('test-only-private-random-secret-value'),
  );
});

test('administrator security validation rejects both public template placeholders', () => {
  assert.throws(
    () => rejectTemplateAdminCredentials(
      'admin@example.com',
      'test-only-strong-password',
    ),
    /ADMIN_EMAIL must be replaced/,
  );
  assert.throws(
    () => rejectTemplateAdminCredentials(
      'administrator@test.invalid',
      'replace_with_a_strong_password',
    ),
    /ADMIN_PASSWORD must be replaced/,
  );
  assert.doesNotThrow(
    () => rejectTemplateAdminCredentials(
      'administrator@test.invalid',
      'test-only-strong-password',
    ),
  );
});
