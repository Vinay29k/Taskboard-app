// Entry point: connects storage, starts the HTTP server, and handles graceful shutdown.
const config = require('./config');
const logger = require('./logger');
const { createApp } = require('./app');
const { createStore } = require('./store');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The database may start after the app (docker compose, Kubernetes), so retry instead of crashing.
async function initStoreWithRetry(store, attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await store.init();
      return;
    } catch (err) {
      logger.warn('storage not ready, retrying', { attempt: i, attempts, error: err.message });
      if (i === attempts) throw err;
      await sleep(delayMs);
    }
  }
}

async function main() {
  const store = createStore(config);
  await initStoreWithRetry(store);

  const state = { shuttingDown: false };
  const app = createApp({ store, state });

  const server = app.listen(config.port, config.host, () => {
    logger.info('taskboard started', {
      url: `http://${config.host}:${config.port}`,
      version: config.appVersion,
      storage: store.kind,
      env: config.nodeEnv,
    });
  });

  // SIGTERM is what Docker/Kubernetes send when stopping a container.
  const shutdown = (signal) => {
    if (state.shuttingDown) return;
    state.shuttingDown = true; // /readyz now returns 503
    logger.info('shutdown started', { signal });

    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, config.shutdownTimeoutMs).unref();

    server.close(async () => {
      await store.close();
      logger.info('shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('failed to start', { error: err.message });
  process.exit(1);
});
