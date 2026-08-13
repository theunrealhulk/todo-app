class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async list() {
    const { rows } = await this.pool.query(
      'SELECT id, title, status, created_at FROM tasks ORDER BY id ASC'
    );
    return rows;
  }

  async create(title) {
    const { rows } = await this.pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, status, created_at',
      [title]
    );
    return rows[0];
  }

  async remove(id) {
    const { rowCount } = await this.pool.query(
      'DELETE FROM tasks WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  }
}

class MemoryRepository {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
  }

  async list() {
    return this.tasks.slice();
  }

  async create(title) {
    const task = { id: this.nextId++, title, status: 'todo' };
    this.tasks.push(task);
    return { ...task };
  }

  async remove(id) {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    return true;
  }
}

module.exports = { PostgresRepository, MemoryRepository };
