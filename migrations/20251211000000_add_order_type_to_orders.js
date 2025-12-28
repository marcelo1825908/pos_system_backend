const db = require('../config/database');

// Migration to add order_type column to orders table
module.exports = {
  name: '20251211000000_add_order_type_to_orders',
  
  up: async () => {
    // Check if orders table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'orders'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️ orders table does not exist yet, skipping migration');
      return;
    }
    
    try {
      // Add order_type column
      await db.exec(`ALTER TABLE orders ADD COLUMN order_type VARCHAR(255) DEFAULT 'horeca'`);
      console.log('✅ Added order_type column to orders table');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('⚠️ order_type column already exists');
      } else {
        throw err;
      }
    }
  },

  down: async () => {
    // PostgreSQL supports DROP COLUMN
    try {
      await db.exec(`ALTER TABLE orders DROP COLUMN order_type`);
      console.log('✅ Removed order_type column from orders table');
    } catch (err) {
      console.log('⚠️ Error removing order_type column:', err.message);
    }
  }
};
