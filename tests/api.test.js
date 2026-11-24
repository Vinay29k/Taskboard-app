const request = require('supertest');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store/memoryStore');

function buildApp(state) {
  return createApp({ store: createMemoryStore(), state });
}

describe('health endpoints', () => {
  test('GET /healthz returns ok', async () => {
    const res = await request(buildApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /readyz returns ready', async () => {
    const res = await request(buildApp()).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /readyz returns 503 while shutting down', async () => {
    const res = await request(buildApp({ shuttingDown: true })).get('/readyz');
    expect(res.status).toBe(503);
  });

  test('GET /metrics exposes Prometheus metrics', async () => {
    const app = buildApp();
    await request(app).get('/api/tasks');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('taskboard_tasks_created_total');
  });

  test('GET /api/info returns app info', async () => {
    const res = await request(buildApp()).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ app: 'taskboard', storage: 'memory' });
    expect(res.body.hostname).toBeTruthy();
  });
});

describe('tasks API', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  test('starts with an empty list', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '  Write Dockerfile  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write Dockerfile',
      description: '',
      status: 'todo',
      priority: 'medium',
    });
    expect(res.body.id).toBeTruthy();
  });

  test('rejects a task without a title', async () => {
    const res = await request(app).post('/api/tasks').send({ description: 'no title' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/title/);
  });

  test('rejects invalid status and priority', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', status: 'nope', priority: 'urgent' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(2);
  });

  test('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
  });

  test('gets, updates and deletes a task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Set up CI', priority: 'high' });
    const id = created.body.id;

    const fetched = await request(app).get(`/api/tasks/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.title).toBe('Set up CI');

    const updated = await request(app).patch(`/api/tasks/${id}`).send({ status: 'in_progress' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('in_progress');
    expect(updated.body.priority).toBe('high');

    const filtered = await request(app).get('/api/tasks?status=in_progress');
    expect(filtered.body).toHaveLength(1);

    const deleted = await request(app).delete(`/api/tasks/${id}`);
    expect(deleted.status).toBe(204);

    const missing = await request(app).get(`/api/tasks/${id}`);
    expect(missing.status).toBe(404);
  });

  test('PATCH with an empty body is rejected', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'x' });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('PATCH / DELETE on unknown id return 404', async () => {
    expect((await request(app).patch('/api/tasks/does-not-exist').send({ status: 'done' })).status).toBe(404);
    expect((await request(app).delete('/api/tasks/does-not-exist')).status).toBe(404);
  });

  test('unknown API route returns JSON 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('serves the frontend', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('TaskBoard');
  });
});
