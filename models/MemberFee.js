const db = require('../config/database');

class MemberFee {
  static async getAll() {
    const sql = 'SELECT * FROM member_fees ORDER BY id ASC';
    const result = await db.all(sql);
    console.log('🔍 MemberFee.getAll() - SQL:', sql);
    console.log('🔍 MemberFee.getAll() - result:', JSON.stringify(result, null, 2));
    console.log('🔍 MemberFee.getAll() - result type:', typeof result, 'isArray:', Array.isArray(result));
    if (Array.isArray(result) && result.length > 0) {
      console.log('🔍 MemberFee.getAll() - first row:', JSON.stringify(result[0], null, 2));
      console.log('🔍 MemberFee.getAll() - first row keys:', Object.keys(result[0]));
    }
    return result;
  }

  static async getById(id) {
    const sql = 'SELECT * FROM member_fees WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(member_fee) {
    const sql = 'INSERT INTO member_fees (member_fee) VALUES ($1) RETURNING id';
    const result = await db.run(sql, [member_fee]);
    return { id: result.lastInsertRowid, member_fee };
  }

  static async update(id, member_fee) {
    const sql = 'UPDATE member_fees SET member_fee = $1 WHERE id = $2';
    await db.run(sql, [member_fee, id]);
    return { id, member_fee };
  }

  static async delete(id) {
    const sql = 'DELETE FROM member_fees WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = MemberFee;
