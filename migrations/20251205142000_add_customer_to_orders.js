const db = require('../config/database');

module.exports = {
  name: '20251205142000_add_customer_to_orders',
  up: async () => {
    console.log('Running migration: add customer_id to orders');
    
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
    
    // Check if column already exists
    try {
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_id'
      `);
      
      if (columnCheck.rows.length === 0) {
        await db.exec(`ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id)`);
        console.log('✅ Added customer_id column to orders table');
      } else {
        console.log('⚠️ customer_id column already exists in orders table');
      }
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        throw err;
      }
      console.log('⚠️ customer_id column already exists in orders table');
    }
  }
};
