const db = require('../config/database');

module.exports = {
  name: '20251212000000_add_employee_id_to_orders',
  up: async () => {
    console.log('Running migration: add employee_id to orders');
    
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
        WHERE table_name = 'orders' AND column_name = 'employee_id'
      `);
      
      if (columnCheck.rows.length === 0) {
        await db.exec(`ALTER TABLE orders ADD COLUMN employee_id INTEGER`);
        console.log('✅ Added employee_id column to orders table');
      } else {
        console.log('⚠️ employee_id column already exists in orders table');
      }
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        throw err;
      }
      console.log('⚠️ employee_id column already exists in orders table');
    }
  }
};
