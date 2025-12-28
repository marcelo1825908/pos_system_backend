const db = require('../config/database');

module.exports = {
  name: '20250101000000_create_terminals_table',
  up: async () => {
    console.log('Running migration: create terminals table');
    
    // Create terminals table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS terminals (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(255) DEFAULT 'active',
        last_seen TIMESTAMP,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add device_id column to orders table (if it exists)
    try {
      const ordersTableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'orders'
      `);
      
      if (ordersTableCheck.rows.length > 0) {
        await db.exec(`ALTER TABLE orders ADD COLUMN device_id VARCHAR(255)`);
      }
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.log('Note: device_id column may already exist in orders table, or orders table does not exist');
      }
    }

    // Create index on device_id for faster lookups
    try {
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_device_id ON orders(device_id)`);
    } catch (err) {
      console.log('Note: Index may already exist');
    }

    console.log('✅ Terminals table created successfully');
  }
};

