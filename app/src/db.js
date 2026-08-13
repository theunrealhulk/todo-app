const { Pool } = require('pg');

let pool = null;

function init(connectionString) {
  pool = new Pool({ connectionString });
}

function getPool() {
  if (!pool) throw new Error('DB not initialised, call init() first');
  return pool;
}

async function ensureSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { init, getPool, ensureSchema };
