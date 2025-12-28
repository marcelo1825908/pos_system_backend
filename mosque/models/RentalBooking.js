const db = require('../../config/database');

/**
 * RentalBooking Model
 * Handles rental bookings for space/kitchen rentals
 */
class RentalBooking {
  /**
   * Get all rental bookings
   */
  static async getAll() {
    return await db.all(`
      SELECT * FROM rental_bookings 
      ORDER BY start_datetime DESC
    `);
  }

  /**
   * Get rental booking by ID
   */
  static async getById(id) {
    return await db.get('SELECT * FROM rental_bookings WHERE id = $1', [id]);
  }

  /**
   * Get rental bookings by member ID
   */
  static async getByMemberId(memberId) {
    return await db.all(`
      SELECT * FROM rental_bookings 
      WHERE member_id = $1 
      ORDER BY start_datetime DESC
    `, [memberId]);
  }

  /**
   * Check for overlapping bookings
   * Returns true if there's an overlap, false otherwise
   */
  static async checkOverlap(startDatetime, endDatetime, excludeId = null) {
    let query = `
      SELECT COUNT(*) as count 
      FROM rental_bookings 
      WHERE status = 'active'
        AND (
          (start_datetime < $1 AND end_datetime > $2)
          OR (start_datetime < $3 AND end_datetime > $3)
          OR (start_datetime >= $4 AND end_datetime <= $5)
        )
    `;
    
    const params = [endDatetime, startDatetime, endDatetime, startDatetime, endDatetime];
    
    if (excludeId) {
      query += ' AND id != $6';
      params.push(excludeId);
    }
    
    const result = await db.get(query, params);
    return parseInt(result.count) > 0;
  }

  /**
   * Get overlapping bookings (for detailed error messages)
   */
  static async getOverlappingBookings(startDatetime, endDatetime, excludeId = null) {
    let query = `
      SELECT * 
      FROM rental_bookings 
      WHERE status = 'active'
        AND (
          (start_datetime < $1 AND end_datetime > $2)
          OR (start_datetime < $3 AND end_datetime > $3)
          OR (start_datetime >= $4 AND end_datetime <= $5)
        )
    `;
    
    const params = [endDatetime, startDatetime, endDatetime, startDatetime, endDatetime];
    
    if (excludeId) {
      query += ' AND id != $6';
      params.push(excludeId);
    }
    
    return await db.all(query, params);
  }

  /**
   * Create a new rental booking
   */
  static async create(bookingData) {
    const {
      member_id,
      member_name,
      start_datetime,
      end_datetime,
      duration_hours,
      amount,
      transaction_id,
      payment_method,
      status = 'active'
    } = bookingData;

    // Check for overlaps before creating
    if (await this.checkOverlap(start_datetime, end_datetime)) {
      throw new Error('OVERLAP_ERROR: This time slot overlaps with an existing booking');
    }

    // Calculate duration in days (rental charge is per day)
    const durationDays = Math.floor(duration_hours / 24);

    const sql = `
      INSERT INTO rental_bookings (
        member_id, member_name, start_datetime, end_datetime, 
        duration_hours, amount, transaction_id, payment_method, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const result = await db.run(sql, [
      member_id,
      member_name,
      start_datetime,
      end_datetime,
      duration_hours,
      amount,
      transaction_id,
      payment_method,
      status
    ]);

    return await this.getById(result.lastInsertRowid);
  }

  /**
   * Update a rental booking
   */
  static async update(id, bookingData) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Rental booking not found');
    }

    const {
      start_datetime,
      end_datetime,
      duration_hours,
      amount,
      status
    } = bookingData;

    // Check for overlaps if dates are being updated
    if (start_datetime && end_datetime) {
      if (await this.checkOverlap(start_datetime, end_datetime, id)) {
        throw new Error('OVERLAP_ERROR: This time slot overlaps with an existing booking');
      }
    }

    const sql = `
      UPDATE rental_bookings 
      SET start_datetime = COALESCE($1, start_datetime),
          end_datetime = COALESCE($2, end_datetime),
          duration_hours = COALESCE($3, duration_hours),
          amount = COALESCE($4, amount),
          status = COALESCE($5, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;

    await db.run(sql, [
      start_datetime || null,
      end_datetime || null,
      duration_hours || null,
      amount || null,
      status || null,
      id
    ]);

    return await this.getById(id);
  }

  /**
   * Delete a rental booking
   */
  static async delete(id) {
    const result = await db.run('DELETE FROM rental_bookings WHERE id = $1', [id]);
    
    if (result.changes === 0) {
      throw new Error('Rental booking not found');
    }
    
    return { success: true, message: 'Rental booking deleted successfully' };
  }

  /**
   * Get bookings by date range
   */
  static async getByDateRange(startDate, endDate) {
    return await db.all(`
      SELECT * FROM rental_bookings 
      WHERE start_datetime >= $1 AND start_datetime <= $2
      ORDER BY start_datetime ASC
    `, [startDate, endDate]);
  }

  /**
   * Get active bookings
   */
  static async getActive() {
    return await db.all(`
      SELECT * FROM rental_bookings 
      WHERE status = 'active'
      ORDER BY start_datetime ASC
    `);
  }
}

module.exports = RentalBooking;
