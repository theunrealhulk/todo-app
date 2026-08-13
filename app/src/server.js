const { createApp } = require('./app');
const { init, getPool, ensureSchema } = require('./db');
const { PostgresRepository } = require('./repository');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://todo:todo@localhost:5432/todo';

async function main() {
  init(DATABASE_URL);
  await ensureSchema();

  const app = createApp(new PostgresRepository(getPool()));
  app.listen(PORT, () => {
    console.log(`todo-app listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start todo-app:', err.message);
  process.exit(1);
});
