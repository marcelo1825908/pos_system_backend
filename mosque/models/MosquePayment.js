const db = require('../../config/database');

class MosquePayment {
  static async getAll() {
    const sql = 'SELECT * FROM mosque_payments ORDER BY created_at DESC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM mosque_payments WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async getByTransactionId(transactionId) {
    const sql = 'SELECT * FROM mosque_payments WHERE transaction_id = $1';
    return await db.get(sql, [transactionId]);
  }

  static async getByMemberId(memberId) {
    const sql = 'SELECT * FROM mosque_payments WHERE member_id = $1 ORDER BY created_at DESC';
    return await db.all(sql, [memberId]);
  }

  static async create(paymentData) {
    const {
      transaction_id,
      member_id,
      member_name,
      payment_type,
      payment_subtype,
      amount,
      payment_method,
      sadaka_goal,
      sadaka_type,
      rent_start_date,
      rent_start_time,
      rent_end_date,
      rent_end_time,
      is_half_payment,
      status = 'completed'
    } = paymentData;

    const sql = `
      INSERT INTO mosque_payments (
        transaction_id, member_id, member_name, payment_type, payment_subtype,
        amount, payment_method, sadaka_goal, sadaka_type,
        rent_start_date, rent_start_time, rent_end_date, rent_end_time,
        is_half_payment, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const result = await db.run(sql, [
      transaction_id,
      member_id || null,
      member_name || null,
      payment_type,
      payment_subtype || null,
      amount,
      payment_method,
      sadaka_goal || null,
      sadaka_type || null,
      rent_start_date || null,
      rent_start_time || null,
      rent_end_date || null,
      rent_end_time || null,
      is_half_payment ? 1 : 0,
      status
    ]);

    // PostgreSQL returns the id in result.rows[0].id when using RETURNING
    const newId = result.rows && result.rows[0] ? result.rows[0].id : result.id;
    return { id: newId, ...paymentData };
  }

  static async update(id, paymentData) {
    const {
      status,
      payment_method,
      amount
    } = paymentData;

    const sql = `
      UPDATE mosque_payments 
      SET status = $1, payment_method = $2, amount = $3
      WHERE id = $4
    `;

    await db.run(sql, [status, payment_method, amount, id]);
    return { id, ...paymentData };
  }

  static async delete(id) {
    const sql = 'DELETE FROM mosque_payments WHERE id = $1';
    return await db.run(sql, [id]);
  }

  // Get statistics
  static async getStatsByType(startDate, endDate) {
    const sql = `
      SELECT 
        payment_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM mosque_payments
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY payment_type
    `;
    return await db.all(sql, [startDate, endDate]);
  }

  static async getStatsByMethod(startDate, endDate) {
    const sql = `
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM mosque_payments
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY payment_method
    `;
    return await db.all(sql, [startDate, endDate]);
  }
}

module.exports = MosquePayment;
