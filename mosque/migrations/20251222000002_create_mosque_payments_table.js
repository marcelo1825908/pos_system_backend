const db = require('../../config/database');

module.exports = {
  name: '20251222000002_create_mosque_payments_table',
  
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
        CREATE TABLE IF NOT EXISTS mosque_payments (
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
          rent_start_date TIMESTAMP,
          rent_start_time VARCHAR(255),
          rent_end_date TIMESTAMP,
          rent_end_time VARCHAR(255),
          is_half_payment INTEGER DEFAULT 0,
          status VARCHAR(255) DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
        )
      `;
    } else {
      // Create without foreign key if members table doesn't exist
      sql = `
        CREATE TABLE IF NOT EXISTS mosque_payments (
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
          rent_start_date TIMESTAMP,
          rent_start_time VARCHAR(255),
          rent_end_date TIMESTAMP,
          rent_end_time VARCHAR(255),
          is_half_payment INTEGER DEFAULT 0,
          status VARCHAR(255) DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('⚠️ members table does not exist, creating mosque_payments without foreign key');
    }
    
    await db.exec(sql);
    console.log('✅ Created mosque_payments table');
  },

  down: async () => {
    await db.exec('DROP TABLE IF EXISTS mosque_payments');
    console.log('✅ Dropped mosque_payments table');
  }
};