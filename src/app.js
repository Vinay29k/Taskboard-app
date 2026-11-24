// Builds the Express app. Kept separate from server.js so tests can use it
// without opening a real network port.
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const config = require('./config');
const logger = require('./logger');
const { register, metricsMiddleware } = require('./metrics');
const { healthRouter } = require('./routes/health');
const { tasksRouter } = require('./routes/tasks');

const QUIET_PATHS = new Set(['/healthz', '/readyz', '/metrics']);

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (QUIET_PATHS.has(req.path)) return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });
  next();
}

function createApp({ store, state = { shuttingDown: false } }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(metricsMiddleware);
  app.use(requestLogger);

  app.use(healthRouter(store, state));

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  });

  // Handy later: shows WHICH container/pod answered (watch it change behind a load balancer).
  app.get('/api/info', (req, res) => {
    res.json({
      app: 'taskboard',
      version: config.appVersion,
      environment: config.nodeEnv,
      hostname: os.hostname(),
      storage: store.kind,
    });
  });

  app.use('/api/tasks', tasksRouter(store));

  // Unknown API routes return JSON 404s.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Frontend (static HTML/CSS/JS).
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Error handler (Express 5 forwards rejected promises from async routes here).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    logger.error('unhandled error', { error: err.message, stack: err.stack, path: req.originalUrl });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
