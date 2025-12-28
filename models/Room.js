const db = require('../config/database');

class Room {
  static async getAll() {
    const sql = 'SELECT * FROM rooms ORDER BY id ASC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM rooms WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(name, total_table = 0) {
    const sql = 'INSERT INTO rooms (name, total_table) VALUES ($1, $2) RETURNING id';
    const result = await db.run(sql, [name, total_table]);
    return { id: result.lastInsertRowid, name, total_table };
  }

  static async update(id, name, total_table = 0) {
    const sql = 'UPDATE rooms SET name = $1, total_table = $2 WHERE id = $3';
    await db.run(sql, [name, total_table, id]);
    return { id, name, total_table };
  }

  static async delete(id) {
    const sql = 'DELETE FROM rooms WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = Room;
