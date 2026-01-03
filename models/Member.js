const db = require('../config/database');

class Member {
  static async getAll() {
    const sql = 'SELECT * FROM members ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM members WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async search(searchTerm) {
    const sql = `
      SELECT * FROM members 
      WHERE full_name LIKE $1 OR phone LIKE $2 OR member_id LIKE $3
      ORDER BY created_at DESC
    `;
    const term = `%${searchTerm}%`;
    return await db.all(sql, [term, term, term]);
  }

  static async getNextMemberId() {
    // Get the highest numeric member_id (filter out non-numeric values)
    const sql = `SELECT member_id FROM members WHERE member_id IS NOT NULL AND member_id ~ '^[0-9]+$' ORDER BY CAST(member_id AS INTEGER) DESC LIMIT 1`;
    const result = await db.get(sql);
    
    if (!result || !result.member_id) {
      return '0001'; // Start from 0001
    }
    
    // Increment the member_id
    const currentId = parseInt(result.member_id, 10);
    if (isNaN(currentId)) {
      return '0001'; // If somehow not numeric, start from 0001
    }
    const nextId = currentId + 1;
    return String(nextId).padStart(4, '0');
  }

  static async create(full_name, phone = '', email = '', address = '', member_id = null) {
    // If member_id is not provided, generate the next one
    if (!member_id) {
      member_id = await this.getNextMemberId();
    }
    
    const sql = `
      INSERT INTO members (member_id, full_name, phone, email, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const result = await db.run(sql, [member_id, full_name, phone, email, address]);
    // PostgreSQL returns id in result.rows[0].id when using RETURNING
    const newId = result.rows && result.rows[0] ? result.rows[0].id : result.id || result.lastInsertRowid;
    if (!newId) {
      throw new Error('Failed to create member: no ID returned');
    }
    return await this.getById(newId);
  }

  static async update(id, full_name, phone = '', email = '', address = '', member_id = null) {
    let sql, params;
    
    if (member_id) {
      sql = `
        UPDATE members 
        SET member_id = $1, full_name = $2, phone = $3, email = $4, address = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `;
      params = [member_id, full_name, phone, email, address, id];
    } else {
      sql = `
        UPDATE members 
        SET full_name = $1, phone = $2, email = $3, address = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `;
      params = [full_name, phone, email, address, id];
    }
    
    const result = await db.run(sql, params);
    return result.changes > 0 ? await this.getById(id) : null;
  }

  static async delete(id) {
    const sql = 'DELETE FROM members WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = Member;
