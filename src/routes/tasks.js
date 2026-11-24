const express = require('express');
const { tasksCreated, tasksDeleted } = require('../metrics');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;

// Validates a request body. `partial` = true for PATCH (all fields optional).
function validateTask(body, { partial }) {
  const errors = [];
  const data = {};

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      errors.push('title is required and must be a non-empty string');
    } else if (body.title.trim().length > MAX_TITLE) {
      errors.push(`title must be at most ${MAX_TITLE} characters`);
    } else {
      data.title = body.title.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('description must be a string');
    } else if (body.description.length > MAX_DESCRIPTION) {
      errors.push(`description must be at most ${MAX_DESCRIPTION} characters`);
    } else {
      data.description = body.description.trim();
    }
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    } else {
      data.status = body.status;
    }
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    } else {
      data.priority = body.priority;
    }
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push('at least one of title, description, status, priority must be provided');
  }

  return { errors, data };
}

function tasksRouter(store) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    let tasks = await store.list();
    if (req.query.status) {
      tasks = tasks.filter((t) => t.status === req.query.status);
    }
    res.json(tasks);
  });

  router.get('/:id', async (req, res) => {
    const task = await store.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', async (req, res) => {
    const { errors, data } = validateTask(req.body || {}, { partial: false });
    if (errors.length) return res.status(400).json({ errors });
    const task = await store.create(data);
    tasksCreated.inc();
    res.status(201).json(task);
  });

  router.patch('/:id', async (req, res) => {
    const { errors, data } = validateTask(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    const task = await store.update(req.params.id, data);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await store.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    tasksDeleted.inc();
    res.status(204).end();
  });

  return router;
}

module.exports = { tasksRouter, validateTask, STATUSES, PRIORITIES };
