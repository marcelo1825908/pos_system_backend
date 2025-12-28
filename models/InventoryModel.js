const db = require('../config/database');

const InventoryModel = {

  create: async (product_id, qty) => {
    const sql = `INSERT INTO inventory (product_id, qty) VALUES ($1, $2) RETURNING id`;
    const result = await db.run(sql, [product_id, qty]);
    return result.lastInsertRowid;
  },

  getById: async (id) => {
    return await db.get(`SELECT * FROM inventory WHERE id = $1`, [id]);
  },

  getAll: async () => {
    return await db.all(`
      SELECT i.id, i.product_id, p.name as product_name, i.qty
      FROM inventory i
      JOIN products p ON p.id = i.product_id
    `);
  },

  update: async (id, qty) => {
    const sql = `UPDATE inventory SET qty = $1 WHERE id = $2`;
    const result = await db.run(sql, [qty, id]);
    return result.changes;
  },

  delete: async (id) => {
    const sql = `DELETE FROM inventory WHERE id = $1`;
    const result = await db.run(sql, [id]);
    return result.changes;
  },

  getByProductId: async (product_id) => {
    return await db.get(`SELECT * FROM inventory WHERE product_id = $1`, [product_id]);
  }

};

module.exports = InventoryModel;
