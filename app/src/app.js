const express = require('express');

function createApp(repo) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/tasks', async (_req, res) => {
    try {
      res.json(await repo.list());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const title = (req.body && req.body.title || '').trim();
      if (!title) {
        return res.status(400).json({ error: 'title is required' });
      }
      const task = await repo.create(title);
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'invalid id' });
      }
      const removed = await repo.remove(id);
      if (!removed) {
        return res.status(404).json({ error: 'task not found' });
      }
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };
