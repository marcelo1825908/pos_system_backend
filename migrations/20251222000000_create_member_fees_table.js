const db = require('../config/database');

module.exports = {
  name: '20251222000000_create_member_fees_table',
  
  up: async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS member_fees (
        id SERIAL PRIMARY KEY,
        member_fee DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created member_fees table');
  },

  down: async () => {
    await db.exec('DROP TABLE IF EXISTS member_fees');
    console.log('✅ Dropped member_fees table');
  }
};
