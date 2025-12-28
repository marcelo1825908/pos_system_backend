const db = require('../config/database');

class PrTable {
  static async getAll() {
    const sql = `
      SELECT pt.*, r.name as room_name 
      FROM pr_table pt
      LEFT JOIN rooms r ON pt.room_id = r.id
      ORDER BY pt.id ASC
    `;
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = `
      SELECT pt.*, r.name as room_name 
      FROM pr_table pt
      LEFT JOIN rooms r ON pt.room_id = r.id
      WHERE pt.id = $1
    `;
    return await db.get(sql, [id]);
  }

  static async create(table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size) {
    const sql = 'INSERT INTO pr_table (table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
    const result = await db.run(sql, [table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size]);
    return { id: result.lastInsertRowid, table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size };
  }

  static async update(id, table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size) {
    const sql = 'UPDATE pr_table SET table_no = $1, room_id = $2, order_id = $3, status = $4, description = $5, customer_name = $6, waiter_name = $7, table_size = $8 WHERE id = $9';
    await db.run(sql, [table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size, id]);
    return { id, table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size };
  }

  static async delete(id) {
    const sql = 'DELETE FROM pr_table WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = PrTable;
