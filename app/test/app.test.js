const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { MemoryRepository } = require('../src/repository');

function startServer(repo) {
  const app = createApp(repo);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => server.close(),
      });
    });
  });
}

describe('todo-app API', () => {
  let server;
  let repo;

  before(async () => {
    repo = new MemoryRepository();
    server = await startServer(repo);
  });

  after(() => server.close());

  test('GET /health returns ok', async () => {
    const res = await fetch(`${server.base}/health`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  });

  test('GET /api/tasks returns an empty list initially', async () => {
    const res = await fetch(`${server.base}/api/tasks`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), []);
  });

  test('POST /api/tasks creates a task', async () => {
    const res = await fetch(`${server.base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Terreau des tomates' }),
    });
    assert.strictEqual(res.status, 201);
    const task = await res.json();
    assert.strictEqual(task.title, 'Terreau des tomates');
    assert.strictEqual(task.status, 'todo');
    assert.ok(task.id);
  });

  test('POST /api/tasks rejects an empty title', async () => {
    const res = await fetch(`${server.base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('GET /api/tasks returns created tasks', async () => {
    const res = await fetch(`${server.base}/api/tasks`);
    assert.strictEqual(res.status, 200);
    const tasks = await res.json();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, 'Terreau des tomates');
  });

  test('DELETE /api/tasks/:id removes a task', async () => {
    const created = await (await fetch(`${server.base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'A supprimer' }),
    })).json();

    const del = await fetch(`${server.base}/api/tasks/${created.id}`, {
      method: 'DELETE',
    });
    assert.strictEqual(del.status, 204);

    const missing = await fetch(`${server.base}/api/tasks/${created.id}`, {
      method: 'DELETE',
    });
    assert.strictEqual(missing.status, 404);
  });

  test('DELETE /api/tasks/abc rejects an invalid id', async () => {
    const res = await fetch(`${server.base}/api/tasks/abc`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 400);
  });
});
