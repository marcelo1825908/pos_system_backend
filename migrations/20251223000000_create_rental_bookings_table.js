const db = require('../config/database');

/**
 * Migration: Create rental_bookings table
 * Stores rental bookings with date/time ranges and member information
 */
module.exports = {
  name: '20251223000000_create_rental_bookings_table',
  
  up: async () => {
    // Check if members table exists
    const membersCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'members'
    `);
    
    const membersExists = membersCheck.rows.length > 0;
    
    let sql;
    if (membersExists) {
      // Create with foreign key if members table exists
      sql = `
        CREATE TABLE IF NOT EXISTS rental_bookings (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL,
          member_name VARCHAR(255) NOT NULL,
          start_datetime TIMESTAMP NOT NULL,
          end_datetime TIMESTAMP NOT NULL,
          duration_hours INTEGER NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          status VARCHAR(255) DEFAULT 'active',
          transaction_id VARCHAR(255),
          payment_method VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )
      `;
    } else {
      // Create without foreign key if members table doesn't exist
      sql = `
        CREATE TABLE IF NOT EXISTS rental_bookings (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL,
          member_name VARCHAR(255) NOT NULL,
          start_datetime TIMESTAMP NOT NULL,
          end_datetime TIMESTAMP NOT NULL,
          duration_hours INTEGER NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          status VARCHAR(255) DEFAULT 'active',
          transaction_id VARCHAR(255),
          payment_method VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('⚠️ members table does not exist, creating rental_bookings without foreign key');
    }
    
    await db.exec(sql);
    console.log('✅ rental_bookings table created');
  },

  down: async () => {
    await db.exec('DROP TABLE IF EXISTS rental_bookings');
    console.log('✅ rental_bookings table dropped');
  }
};
