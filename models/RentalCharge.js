const db = require('../config/database');

class RentalCharge {
  static async getAll() {
    const sql = 'SELECT * FROM rental_charges ORDER BY id ASC';
    const result = await db.all(sql);
    console.log('🔍 RentalCharge.getAll() - SQL:', sql);
    console.log('🔍 RentalCharge.getAll() - result:', JSON.stringify(result, null, 2));
    console.log('🔍 RentalCharge.getAll() - result type:', typeof result, 'isArray:', Array.isArray(result));
    if (Array.isArray(result) && result.length > 0) {
      console.log('🔍 RentalCharge.getAll() - first row:', JSON.stringify(result[0], null, 2));
      console.log('🔍 RentalCharge.getAll() - first row keys:', Object.keys(result[0]));
    }
    return result;
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
