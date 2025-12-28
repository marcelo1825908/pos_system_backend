const db = require('../config/database');

class Terminal {
  static async getAll() {
    const sql = 'SELECT * FROM terminals ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM terminals WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async getByDeviceId(deviceId) {
    const sql = 'SELECT * FROM terminals WHERE device_id = $1';
    return await db.get(sql, [deviceId]);
  }

  static async create(deviceId, name, location = null, password = null) {
    const sql = 'INSERT INTO terminals (device_id, name, location, status, password) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const result = await db.run(sql, [deviceId, name, location || '', 'pending', password || '']);
    const terminal = await this.getById(result.lastInsertRowid);
    return { ...terminal, password: password || '' };
  }

  static async update(id, name, location, status, password = null) {
    if (password !== null) {
      const sql = 'UPDATE terminals SET name = $1, location = $2, status = $3, password = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id';
      await db.run(sql, [name, location || '', status || 'active', password, id]);
    } else {
      const sql = 'UPDATE terminals SET name = $1, location = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id';
      await db.run(sql, [name, location || '', status || 'active', id]);
    }
    return await this.getById(id);
  }

  static async verifyPassword(deviceId, password) {
    const sql = 'SELECT * FROM terminals WHERE device_id = $1 AND password = $2';
    return await db.get(sql, [deviceId, password]);
  }

  static async updateLastSeen(deviceId) {
    const sql = 'UPDATE terminals SET last_seen = CURRENT_TIMESTAMP WHERE device_id = $1';
    await db.run(sql, [deviceId]);
  }

  static async delete(id) {
    const sql = 'DELETE FROM terminals WHERE id = $1';
    return await db.run(sql, [id]);
  }

  static async getActiveCount() {
    const sql = 'SELECT COUNT(*) as count FROM terminals WHERE status = $1';
    const result = await db.get(sql, ['active']);
    return parseInt(result.count) || 0;
  }

  static async getOnlineCount() {
    const sql = `
      SELECT COUNT(*) as count 
      FROM terminals 
      WHERE status = $1 
      AND last_seen IS NOT NULL 
      AND last_seen > NOW() - INTERVAL '5 minutes'
    `;
    const result = await db.get(sql, ['active']);
    return parseInt(result.count) || 0;
  }
}

module.exports = Terminal;
