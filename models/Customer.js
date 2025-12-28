const db = require('../config/database');

class Customer {
  static async getAll() {
    const sql = 'SELECT * FROM customers ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM customers WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async search(searchTerm) {
    const sql = `
      SELECT * FROM customers 
      WHERE name LIKE $1 OR phone LIKE $2 OR email LIKE $3
      ORDER BY name ASC
      LIMIT 20
    `;
    const searchPattern = `%${searchTerm}%`;
    return await db.all(sql, [searchPattern, searchPattern, searchPattern]);
  }

  static async create(customerData) {
    const { name, phone, email, address, notes } = customerData;
    const sql = `
      INSERT INTO customers (name, phone, email, address, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const result = await db.run(sql, [name, phone || null, email || null, address || null, notes || null]);
    return { id: result.lastInsertRowid, ...customerData };
  }

  static async update(id, customerData) {
    const { name, phone, email, address, notes } = customerData;
    const sql = `
      UPDATE customers 
      SET name = $1, phone = $2, email = $3, address = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;
    await db.run(sql, [name, phone || null, email || null, address || null, notes || null, id]);
    return { id, ...customerData };
  }

  static async delete(id) {
    const sql = 'DELETE FROM customers WHERE id = $1';
    const result = await db.run(sql, [id]);
    return { deleted: result.changes };
  }
}

module.exports = Customer;
