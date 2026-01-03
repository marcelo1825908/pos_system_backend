const db = require('../config/database');

class PaymentTerminal {
  static async getAll() {
    const sql = 'SELECT * FROM payment_terminals ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM payment_terminals WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async getByType(type) {
    // Check for enabled = 1 (works for integer columns)
    // If column is boolean, we'll handle it in the WHERE clause by checking both
    const sql = 'SELECT * FROM payment_terminals WHERE type = $1 AND enabled = 1';
    const result = await db.get(sql, [type]);
    // Normalize enabled to boolean for consistency
    if (result) {
      result.enabled = result.enabled === 1 || result.enabled === true || result.enabled === '1' || result.enabled === 'true';
    }
    return result;
  }

  static async create(data) {
    const { name, type, connection_type, connection_string, enabled = 1 } = data;
    const sql = `
      INSERT INTO payment_terminals (name, type, connection_type, connection_string, enabled)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const result = await db.run(sql, [name, type, connection_type, connection_string, enabled]);
    return await this.getById(result.lastInsertRowid);
  }

  static async update(id, data) {
    const { name, type, connection_type, connection_string, enabled } = data;
    const sql = `
      UPDATE payment_terminals 
      SET name = $1, type = $2, connection_type = $3, connection_string = $4, enabled = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;
    const result = await db.run(sql, [name, type, connection_type, connection_string, enabled, id]);
    return result.changes > 0 ? await this.getById(id) : null;
  }

  static async delete(id) {
    const sql = 'DELETE FROM payment_terminals WHERE id = $1';
    const result = await db.run(sql, [id]);
    return result.changes > 0;
  }
}

module.exports = PaymentTerminal;
