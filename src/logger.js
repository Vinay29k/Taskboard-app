// Minimal structured (JSON) logger that writes to stdout/stderr.
// Containers should log to stdout; the platform (Docker, K8s, Loki...) collects it.
const config = require('./config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, msg, extra = {}) {
  if (LEVELS[level] < threshold) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

module.exports = {
  debug: (msg, extra) => log('debug', msg, extra),
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
};
