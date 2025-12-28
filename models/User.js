const db = require('../config/database');

class User {
  static async getAll() {
    const sql = 'SELECT * FROM users ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM users WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(name, pincode, social_security = '', identification = '', role = 'User', avatar_color = '#3b82f6', permissions = '[]') {
    const sql = `
      INSERT INTO users (name, pincode, social_security, identification, role, avatar_color, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const result = await db.run(sql, [name, pincode, social_security, identification, role, avatar_color, permissions]);
    return await this.getById(result.lastInsertRowid);
  }

  static async update(id, name, pincode, social_security = '', identification = '', role = 'User', avatar_color = '#3b82f6', permissions = '[]') {
    const sql = `
      UPDATE users 
      SET name = $1, pincode = $2, social_security = $3, identification = $4, role = $5, avatar_color = $6, permissions = $7
      WHERE id = $8
    `;
    const result = await db.run(sql, [name, pincode, social_security, identification, role, avatar_color, permissions, id]);
    return result.changes > 0 ? await this.getById(id) : null;
  }

  static async updatePermissions(id, permissions) {
    const sql = 'UPDATE users SET permissions = $1 WHERE id = $2';
    const result = await db.run(sql, [permissions, id]);
    return result.changes > 0 ? await this.getById(id) : null;
  }

  static async delete(id) {
    const sql = 'DELETE FROM users WHERE id = $1';
    return await db.run(sql, [id]);
  }

  static async verifyPincode(userId, pincode) {
    const sql = 'SELECT * FROM users WHERE id = $1 AND pincode = $2';
    return await db.get(sql, [userId, pincode]);
  }

  static async verifyByNameAndPincode(name, pincode) {
    const sql = 'SELECT * FROM users WHERE name = $1 AND pincode = $2';
    return await db.get(sql, [name, pincode]);
  }
}

module.exports = User;
