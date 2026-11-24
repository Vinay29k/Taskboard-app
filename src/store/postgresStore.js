// PostgreSQL store: persistent and shared across all app replicas.
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id          UUID PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      VARCHAR(20) NOT NULL DEFAULT 'todo',
    priority    VARCHAR(10) NOT NULL DEFAULT 'medium',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const UPDATABLE_COLUMNS = ['title', 'description', 'status', 'priority'];

function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Postgres raises 22P02 when a non-UUID string is used as an id; treat it as "not found".
function isInvalidId(err) {
  return err && err.code === '22P02';
}

function createPostgresStore(connectionString) {
  const pool = new Pool({ connectionString, max: 10 });

  return {
    kind: 'postgres',

    async init() {
      await pool.query(SCHEMA);
    },

    async list() {
      const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at ASC');
      return rows.map(toTask);
    },

    async get(id) {
      try {
        const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
        return rows[0] ? toTask(rows[0]) : null;
      } catch (err) {
        if (isInvalidId(err)) return null;
        throw err;
      }
    },

    async create({ title, description = '', status = 'todo', priority = 'medium' }) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (id, title, description, status, priority)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [randomUUID(), title, description, status, priority],
      );
      return toTask(rows[0]);
    },

    async update(id, fields) {
      const sets = [];
      const values = [];
      for (const column of UPDATABLE_COLUMNS) {
        if (fields[column] !== undefined) {
          values.push(fields[column]);
          sets.push(`${column} = $${values.length}`);
        }
      }
      sets.push('updated_at = now()');
      values.push(id);
      try {
        const { rows } = await pool.query(
          `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
          values,
        );
        return rows[0] ? toTask(rows[0]) : null;
      } catch (err) {
        if (isInvalidId(err)) return null;
        throw err;
      }
    },

    async remove(id) {
      try {
        const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        return rowCount > 0;
      } catch (err) {
        if (isInvalidId(err)) return false;
        throw err;
      }
    },

    async ping() {
      await pool.query('SELECT 1');
      return true;
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = { createPostgresStore };
