const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConfig,
  validateDatabaseConfig,
} = require('../config/database');

function validEnvironment(overrides = {}) {
  return {
    DB_SERVER: 'DESKTOP-1NNA0J7',
    DB_INSTANCE: 'SQLEXPRESS',
    DB_NAME: 'StudyPilot',
    DB_AUTH_MODE: 'windows',
    DB_TRUST_SERVER_CERTIFICATE: 'true',
    DB_ENCRYPT: 'false',
    DB_CONNECTION_LIMIT: '10',
    DB_REQUEST_TIMEOUT: '30000',
    DB_CONNECTION_TIMEOUT: '15000',
    ...overrides,
  };
}

test('buildConfig creates a named-instance Windows Authentication configuration', () => {
  const config = buildConfig(validEnvironment());

  assert.equal(config.server, 'DESKTOP-1NNA0J7');
  assert.equal(config.database, 'StudyPilot');
  assert.equal(config.driver, 'ODBC Driver 18 for SQL Server');
  assert.equal(config.options.instanceName, 'SQLEXPRESS');
  assert.equal(config.options.trustedConnection, true);
  assert.equal(config.options.trustServerCertificate, true);
  assert.equal(config.options.encrypt, false);
  assert.equal(config.options.useUTC, true);
  assert.deepEqual(config.pool, { max: 10, min: 0, idleTimeoutMillis: 30000 });
  assert.equal(config.requestTimeout, 30000);
  assert.equal(config.connectionTimeout, 15000);
  assert.equal('user' in config, false);
  assert.equal('password' in config, false);

  const connection = { conn_str: 'Driver={ODBC Driver 18 for SQL Server};' };
  config.beforeConnect(connection);
  assert.match(connection.conn_str, /TrustServerCertificate=Yes;/);
});

test('database validation requires the server, named instance, and database', () => {
  assert.throws(
    () => validateDatabaseConfig(validEnvironment({
      DB_SERVER: '',
      DB_INSTANCE: '',
      DB_NAME: '',
    })),
    /DB_SERVER, DB_INSTANCE, DB_NAME/,
  );
});

test('database validation permits only Windows Authentication', () => {
  assert.throws(
    () => validateDatabaseConfig(validEnvironment({ DB_AUTH_MODE: 'sql' })),
    /DB_AUTH_MODE must be windows/,
  );
});

test('database validation rejects invalid booleans and timeout values', () => {
  assert.throws(
    () => buildConfig(validEnvironment({ DB_ENCRYPT: 'sometimes' })),
    /DB_ENCRYPT must be either true or false/,
  );
  assert.throws(
    () => buildConfig(validEnvironment({ DB_REQUEST_TIMEOUT: '0' })),
    /DB_REQUEST_TIMEOUT must be a positive integer/,
  );
  assert.throws(
    () => buildConfig(validEnvironment({ DB_CONNECTION_LIMIT: '2.5' })),
    /DB_CONNECTION_LIMIT must be a positive integer/,
  );
});

test('buildConfig applies documented defaults for optional settings', () => {
  const config = buildConfig({
    DB_SERVER: 'DESKTOP-1NNA0J7',
    DB_INSTANCE: 'SQLEXPRESS',
    DB_NAME: 'StudyPilot',
  });

  assert.equal(config.options.trustServerCertificate, true);
  assert.equal(config.options.encrypt, false);
  assert.equal(config.pool.max, 10);
  assert.equal(config.requestTimeout, 30000);
  assert.equal(config.connectionTimeout, 15000);
});
