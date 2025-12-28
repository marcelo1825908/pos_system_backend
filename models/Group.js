const db = require('../config/database');

class Group {
  static async getAll() {
    const sql = 'SELECT * FROM groups ORDER BY id ASC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM groups WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(name, is_visible = 0) {
    const sql = 'INSERT INTO groups (name, is_visible) VALUES ($1, $2) RETURNING id';
    const result = await db.run(sql, [name, is_visible ? 1 : 0]);
    return { id: result.lastInsertRowid, name, is_visible: is_visible ? 1 : 0 };
  }

  static async update(id, name, is_visible = 0) {
    const sql = 'UPDATE groups SET name = $1, is_visible = $2 WHERE id = $3';
    await db.run(sql, [name, is_visible ? 1 : 0, id]);
    return { id, name, is_visible: is_visible ? 1 : 0 };
  }

  static async delete(id) {
    const sql = 'DELETE FROM groups WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = Group;
