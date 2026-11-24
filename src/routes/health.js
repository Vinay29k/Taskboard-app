// Health endpoints, later used by Docker HEALTHCHECK and Kubernetes probes.
//   /healthz -> liveness:  "is the process alive?"  (never checks dependencies)
//   /readyz  -> readiness: "can I serve traffic?"   (checks the database)
const express = require('express');

function healthRouter(store, state) {
  const router = express.Router();

  router.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/readyz', async (req, res) => {
    if (state.shuttingDown) {
      return res.status(503).json({ status: 'shutting_down' });
    }
    try {
      await store.ping();
      res.json({ status: 'ready', storage: store.kind });
    } catch (err) {
      res.status(503).json({ status: 'not_ready', error: err.message });
    }
  });

  return router;
}

module.exports = { healthRouter };
