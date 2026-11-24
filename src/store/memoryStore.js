// In-memory store: zero setup, great for local dev and tests.
// Data disappears when the process restarts (and is NOT shared between replicas).
const { randomUUID } = require('node:crypto');

function createMemoryStore() {
  const tasks = new Map();

  return {
    kind: 'memory',

    async init() {},

    async list() {
      return [...tasks.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async get(id) {
      return tasks.get(id) || null;
    },

    async create({ title, description = '', status = 'todo', priority = 'medium' }) {
      const now = new Date().toISOString();
      const task = { id: randomUUID(), title, description, status, priority, createdAt: now, updatedAt: now };
      tasks.set(task.id, task);
      return task;
    },

    async update(id, fields) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...fields, updatedAt: new Date().toISOString() };
      tasks.set(id, updated);
      return updated;
    },

    async remove(id) {
      return tasks.delete(id);
    },

    async ping() {
      return true;
    },

    async close() {},
  };
}

module.exports = { createMemoryStore };
