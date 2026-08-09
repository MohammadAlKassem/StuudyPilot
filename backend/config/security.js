const PUBLIC_TEMPLATE_VALUES = Object.freeze({
  jwtSecret: 'replace_with_a_long_random_secret',
  adminEmail: 'admin@example.com',
  adminPassword: 'replace_with_a_strong_password',
});

function rejectTemplateJwtSecret(value) {
  if (typeof value === 'string' && value.trim() === PUBLIC_TEMPLATE_VALUES.jwtSecret) {
    throw new Error('JWT_SECRET must be replaced with a private cryptographically random value');
  }
}

function rejectTemplateAdminCredentials(email, password) {
  if (email === PUBLIC_TEMPLATE_VALUES.adminEmail) {
    throw new Error('ADMIN_EMAIL must be replaced with a non-example administrator email');
  }

  if (
    typeof password === 'string'
    && password.trim() === PUBLIC_TEMPLATE_VALUES.adminPassword
  ) {
    throw new Error('ADMIN_PASSWORD must be replaced with a private strong password');
  }
}

module.exports = {
  rejectTemplateJwtSecret,
  rejectTemplateAdminCredentials,
};
