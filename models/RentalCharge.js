const db = require('../config/database');

class RentalCharge {
  static async getAll() {
    const sql = 'SELECT * FROM rental_charges ORDER BY id ASC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM rental_charges WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(rental_charge) {
    const sql = 'INSERT INTO rental_charges (rental_charge) VALUES ($1) RETURNING id';
    const result = await db.run(sql, [rental_charge]);
    return { id: result.lastInsertRowid, rental_charge };
  }

  static async update(id, rental_charge) {
    const sql = 'UPDATE rental_charges SET rental_charge = $1 WHERE id = $2';
    await db.run(sql, [rental_charge, id]);
    return { id, rental_charge };
  }

  static async delete(id) {
    const sql = 'DELETE FROM rental_charges WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = RentalCharge;
