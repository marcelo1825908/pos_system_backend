const db = require('../config/database');

module.exports = {
  name: '20251205141918_create_customers_table',
  up: async () => {
    console.log('Running migration: create customers table');
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Customers table created successfully');
  }
};
