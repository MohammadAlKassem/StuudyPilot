const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

// server.js creates the app at import time, so provide safe test configuration first.
process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DB_SERVER = 'test-sql-server';
process.env.DB_INSTANCE = 'SQLEXPRESS';
process.env.DB_NAME = 'StudyPilotTest';
process.env.DB_AUTH_MODE = 'windows';
process.env.DB_TRUST_SERVER_CERTIFICATE = 'true';
process.env.DB_ENCRYPT = 'false';
process.env.DB_CONNECTION_LIMIT = '2';
process.env.DB_REQUEST_TIMEOUT = '30000';
process.env.DB_CONNECTION_TIMEOUT = '15000';
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-24-characters';
process.env.JWT_EXPIRES_IN = '8h';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { app } = require('../server');
const { closePool } = require('../config/database');

after(async () => {
  await closePool();
});

test('GET /api/health returns the safe health response', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect('Content-Type', /json/)
    .expect(200);

  assert.deepEqual(response.body, {
    success: true,
    message: 'StudyPilot API is running',
  });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('an unknown API route returns the standard 404 response', async () => {
  const response = await request(app)
    .get('/api/does-not-exist')
    .expect('Content-Type', /json/)
    .expect(404);

  assert.deepEqual(response.body, {
    success: false,
    message: 'Route GET /api/does-not-exist not found',
    code: 'NOT_FOUND',
  });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('all protected feature routers are mounted behind authentication', async () => {
  const mountedPaths = [
    '/api/auth/me',
    '/api/courses',
    '/api/courses/1/tasks',
    '/api/tasks/1',
    '/api/notes',
    '/api/study-plans',
    '/api/admin/stats',
  ];

  for (const path of mountedPaths) {
    const response = await request(app).get(path).expect(401);
    assert.equal(response.body.success, false, path);
    assert.equal(response.body.code, 'AUTHENTICATION_REQUIRED', path);
  }
});

test('malformed JSON is handled with a controlled client error', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send('{"name":')
    .expect(400);

  assert.deepEqual(response.body, {
    success: false,
    message: 'Request body contains invalid JSON',
    code: 'INVALID_JSON',
  });
});

test('CORS rejects a browser origin outside CLIENT_ORIGIN', async () => {
  const response = await request(app)
    .get('/api/health')
    .set('Origin', 'https://untrusted.example')
    .expect(403);

  assert.deepEqual(response.body, {
    success: false,
    message: 'Origin is not allowed by CORS',
    code: 'CORS_FORBIDDEN',
  });
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});
