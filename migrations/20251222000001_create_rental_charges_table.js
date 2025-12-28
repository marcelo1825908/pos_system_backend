const db = require('../config/database');

module.exports = {
  name: '20251222000001_create_rental_charges_table',
  
  up: async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS rental_charges (
        id SERIAL PRIMARY KEY,
        rental_charge DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created rental_charges table');
  },

  down: async () => {
    await db.exec('DROP TABLE IF EXISTS rental_charges');
    console.log('✅ Dropped rental_charges table');
  }
};
