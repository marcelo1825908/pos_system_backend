const db = require('../config/database');

/**
 * Migration: Create base tables if they don't exist
 * This migration creates the fundamental tables that other migrations depend on
 */
module.exports = {
  name: '000-create-base-tables',
  
  up: async () => {
    console.log('Running migration: Create base tables');
    
    try {
      // Create members table if it doesn't exist
      const membersTableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'members'
      `);
      
      if (membersTableCheck.rows.length === 0) {
        console.log('Creating members table...');
        await db.exec(`
          CREATE TABLE members (
            id SERIAL PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(255) DEFAULT '',
            email VARCHAR(255) DEFAULT '',
            address TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ members table created');
      } else {
        console.log('members table already exists, skipping');
      }

      // Create mosque_payments table if it doesn't exist
      const paymentsTableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'mosque_payments'
      `);
      
      if (paymentsTableCheck.rows.length === 0) {
        console.log('Creating mosque_payments table...');
        await db.exec(`
          CREATE TABLE mosque_payments (
            id SERIAL PRIMARY KEY,
            transaction_id VARCHAR(255) UNIQUE NOT NULL,
            member_id INTEGER,
            member_name VARCHAR(255),
            payment_type VARCHAR(255) NOT NULL,
            payment_subtype VARCHAR(255),
            amount DECIMAL(10, 2) NOT NULL,
            payment_method VARCHAR(255) NOT NULL,
            sadaka_goal VARCHAR(255),
            sadaka_type VARCHAR(255),
            rent_start_date DATE,
            rent_start_time TIME,
            rent_end_date DATE,
            rent_end_time TIME,
            is_half_payment INTEGER DEFAULT 0,
            status VARCHAR(255) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ mosque_payments table created');
      } else {
        console.log('mosque_payments table already exists, skipping');
      }

      console.log('Migration 000-create-base-tables completed successfully');
    } catch (error) {
      console.error('Migration 000-create-base-tables failed:', error);
      throw error;
    }
  },
  
  down: async () => {
    console.log('Rolling back migration: Drop base tables');
    
    try {
      // Drop tables in reverse order (respecting foreign keys)
      await db.exec('DROP TABLE IF EXISTS mosque_payments');
      await db.exec('DROP TABLE IF EXISTS members');
      
      console.log('Rollback 000-create-base-tables completed successfully');
    } catch (error) {
      console.error('Rollback 000-create-base-tables failed:', error);
      throw error;
    }
  }
};

