// All configuration comes from environment variables (12-factor style).
// This makes the same code run unchanged on a laptop, in Docker, and in Kubernetes.
const pkg = require('../package.json');

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  nodeEnv,
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  // Empty DATABASE_URL => in-memory store (data is lost on restart).
  // Example: postgres://taskboard:secret@localhost:5432/taskboard
  databaseUrl: process.env.DATABASE_URL || '',
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
  appVersion: process.env.APP_VERSION || pkg.version,
  shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10),
};
