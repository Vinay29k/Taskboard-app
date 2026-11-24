const { createMemoryStore } = require('./memoryStore');
const { createPostgresStore } = require('./postgresStore');

// Pick the storage backend from configuration.
function createStore({ databaseUrl }) {
  return databaseUrl ? createPostgresStore(databaseUrl) : createMemoryStore();
}

module.exports = { createStore };
