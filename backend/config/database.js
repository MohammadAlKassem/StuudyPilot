const sql = require('mssql/msnodesqlv8');

const INTEGER_DEFAULTS = Object.freeze({
  DB_CONNECTION_LIMIT: 10,
  DB_REQUEST_TIMEOUT: 30000,
  DB_CONNECTION_TIMEOUT: 15000,
});

const BOOLEAN_DEFAULTS = Object.freeze({
  DB_TRUST_SERVER_CERTIFICATE: true,
  DB_ENCRYPT: false,
});

const ODBC_DRIVER = 'ODBC Driver 18 for SQL Server';

function requiredEnvironmentString(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required database configuration: ${name}`);
  }
  return value.trim();
}

function parsePositiveEnvironmentInteger(environment, name, fallback) {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function parseEnvironmentBoolean(environment, name, fallback) {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const normalizedValue = String(rawValue).trim().toLowerCase();
  if (normalizedValue === 'true') return true;
  if (normalizedValue === 'false') return false;

  throw new Error(`${name} must be either true or false`);
}

function validateDatabaseConfig(environment = process.env) {
  const missing = ['DB_SERVER', 'DB_INSTANCE', 'DB_NAME'].filter(
    (name) => typeof environment[name] !== 'string' || !environment[name].trim(),
  );

  if (missing.length) {
    throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  }

  const authMode = String(environment.DB_AUTH_MODE || 'windows').trim().toLowerCase();
  if (authMode !== 'windows') {
    throw new Error('DB_AUTH_MODE must be windows; SQL Server Authentication is not configured');
  }

  for (const [name, fallback] of Object.entries(INTEGER_DEFAULTS)) {
    parsePositiveEnvironmentInteger(environment, name, fallback);
  }

  for (const [name, fallback] of Object.entries(BOOLEAN_DEFAULTS)) {
    parseEnvironmentBoolean(environment, name, fallback);
  }
}

function buildConfig(environment = process.env) {
  validateDatabaseConfig(environment);

  const trustServerCertificate = parseEnvironmentBoolean(
    environment,
    'DB_TRUST_SERVER_CERTIFICATE',
    BOOLEAN_DEFAULTS.DB_TRUST_SERVER_CERTIFICATE,
  );
  const encrypt = parseEnvironmentBoolean(
    environment,
    'DB_ENCRYPT',
    BOOLEAN_DEFAULTS.DB_ENCRYPT,
  );

  return {
    server: requiredEnvironmentString(environment, 'DB_SERVER'),
    database: requiredEnvironmentString(environment, 'DB_NAME'),
    // mssql otherwise defaults to the legacy SQL Server Native Client 11.0
    // name on Windows, which is not installed on current SQL Server setups.
    driver: ODBC_DRIVER,
    options: {
      trustedConnection: true,
      trustServerCertificate,
      encrypt,
      instanceName: requiredEnvironmentString(environment, 'DB_INSTANCE'),
      useUTC: true,
    },
    pool: {
      max: parsePositiveEnvironmentInteger(
        environment,
        'DB_CONNECTION_LIMIT',
        INTEGER_DEFAULTS.DB_CONNECTION_LIMIT,
      ),
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: parsePositiveEnvironmentInteger(
      environment,
      'DB_REQUEST_TIMEOUT',
      INTEGER_DEFAULTS.DB_REQUEST_TIMEOUT,
    ),
    connectionTimeout: parsePositiveEnvironmentInteger(
      environment,
      'DB_CONNECTION_TIMEOUT',
      INTEGER_DEFAULTS.DB_CONNECTION_TIMEOUT,
    ),
    // The mssql msnodesqlv8 adapter does not currently copy its
    // trustServerCertificate option into the generated ODBC connection string.
    beforeConnect(connectionConfig) {
      if (/TrustServerCertificate\s*=/i.test(connectionConfig.conn_str)) return;
      const separator = connectionConfig.conn_str.endsWith(';') ? '' : ';';
      const trusted = trustServerCertificate ? 'Yes' : 'No';
      connectionConfig.conn_str += `${separator}TrustServerCertificate=${trusted};`;
    },
  };
}

let poolPromise = null;

function getPool() {
  if (poolPromise) return poolPromise;

  const pool = new sql.ConnectionPool(buildConfig());
  pool.on('error', (error) => {
    const safeDiagnostic = error && error.code ? ` (${error.code})` : '';
    console.error(`SQL Server connection pool error${safeDiagnostic}`);
  });
  const connectionPromise = pool.connect()
    .then(() => pool)
    .catch(async (error) => {
      if (poolPromise === connectionPromise) poolPromise = null;
      try {
        await pool.close();
      } catch {
        // Keep the original connection error; the failed pool is no longer cached.
      }
      throw error;
    });

  poolPromise = connectionPromise;
  return poolPromise;
}

async function testConnection() {
  const pool = await getPool();
  const result = await pool.request().query('SELECT 1 AS connection_test;');
  return result.recordset[0];
}

async function closePool() {
  const connectionPromise = poolPromise;
  poolPromise = null;

  if (!connectionPromise) return;

  let pool;
  try {
    pool = await connectionPromise;
  } catch {
    // getPool already closes a pool whose initial connection failed.
    return;
  }

  await pool.close();
}

module.exports = {
  getPool,
  testConnection,
  closePool,
  validateDatabaseConfig,
  sql,
  buildConfig,
};
