const db = require('../config/database');

module.exports = {
  name: '20251208000000_add_order_no_to_orders',
  up: async () => {
    console.log('Running migration: add order_no to orders');
    
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
        WHERE table_name = 'orders' AND column_name = 'order_no'
      `);
      
      if (columnCheck.rows.length === 0) {
        await db.exec(`ALTER TABLE orders ADD COLUMN order_no VARCHAR(255)`);
        console.log('✅ Added order_no column to orders table');
        
        // Generate order_no for existing orders
        const existingOrders = await db.all('SELECT id FROM orders WHERE order_no IS NULL');
        
        for (const order of existingOrders) {
          const orderNo = `ORD-${String(order.id).padStart(6, '0')}`;
          await db.run('UPDATE orders SET order_no = $1 WHERE id = $2', [orderNo, order.id]);
        }
        
        console.log(`✅ Generated order_no for ${existingOrders.length} existing orders`);
      } else {
        console.log('⚠️ order_no column already exists in orders table');
      }
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        throw err;
      }
      console.log('⚠️ order_no column already exists in orders table');
    }
  }
};
