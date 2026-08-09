const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const AppError = require('./utils/AppError');
const { testConnection, closePool, validateDatabaseConfig } = require('./config/database');
const { rejectTemplateJwtSecret } = require('./config/security');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const taskRoutes = require('./routes/taskRoutes');
const noteRoutes = require('./routes/noteRoutes');
const studyPlanRoutes = require('./routes/studyPlanRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function validateEnvironment() {
  validateDatabaseConfig();

  const required = ['JWT_SECRET', 'JWT_EXPIRES_IN', 'CLIENT_ORIGIN'];
  const missing = required.filter((name) => !process.env[name] || !process.env[name].trim());
  if (missing.length) {
    throw new Error(`Missing required environment configuration: ${missing.join(', ')}`);
  }

  rejectTemplateJwtSecret(process.env.JWT_SECRET);

  if (process.env.JWT_SECRET.length < 24) {
    throw new Error('JWT_SECRET must be at least 24 characters long');
  }

  parsePort(process.env.PORT || '5000');

  try {
    const clientUrl = new URL(process.env.CLIENT_ORIGIN);
    if (!['http:', 'https:'].includes(clientUrl.protocol)) throw new Error();
  } catch {
    throw new Error('CLIENT_ORIGIN must be a valid http or https URL');
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      const allowedOrigin = process.env.CLIENT_ORIGIN;
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
        return;
      }
      callback(new AppError('Origin is not allowed by CORS', 403, 'CORS_FORBIDDEN'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'StudyPilot API is running',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/study-plans', studyPlanRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

async function startServer() {
  validateEnvironment();

  try {
    await testConnection();
  } catch (error) {
    const suffix = error.code ? ` (${error.code})` : '';
    throw new Error(
      `Database connection failed${suffix}. Check SQL Server Express, Windows Authentication, and DB_* settings.`,
    );
  }

  const port = parsePort(process.env.PORT || '5000');
  const httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });

  console.log(`StudyPilot API listening on port ${port}`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing StudyPilot API.`);

    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    httpServer.close(async (serverError) => {
      try {
        await closePool();
      } catch {
        serverError = serverError || new Error('Could not close the database pool');
      }
      clearTimeout(forceExitTimer);
      process.exit(serverError ? 1 : 0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return httpServer;
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error(`StudyPilot failed to start: ${error.message}`);
    try {
      await closePool();
    } catch {
      // The original startup error is the useful diagnostic.
    }
    process.exitCode = 1;
  });
}

module.exports = {
  app,
  createApp,
  startServer,
  validateEnvironment,
};
