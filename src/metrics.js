// Prometheus metrics, exposed at GET /metrics.
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const tasksCreated = new client.Counter({
  name: 'taskboard_tasks_created_total',
  help: 'Total number of tasks created',
  registers: [register],
});

const tasksDeleted = new client.Counter({
  name: 'taskboard_tasks_deleted_total',
  help: 'Total number of tasks deleted',
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // Use the route pattern (/api/tasks/:id), not the raw URL, to keep label cardinality low.
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
}

module.exports = { register, metricsMiddleware, tasksCreated, tasksDeleted };
