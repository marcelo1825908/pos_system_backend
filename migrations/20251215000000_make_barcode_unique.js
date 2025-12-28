const db = require('../config/database');

// Migration: Make barcode column unique in products table
module.exports = {
  name: '20251215000000_make_barcode_unique',
  
  up: async () => {
    // Check if products table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'products'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️ products table does not exist yet, skipping migration');
      return;
    }
    
    try {
      // First, check if there are duplicate barcodes
      const duplicates = await db.all(`
        SELECT barcode, COUNT(*) as count 
        FROM products 
        WHERE barcode IS NOT NULL AND barcode != ''
        GROUP BY barcode 
        HAVING COUNT(*) > 1
      `);

      if (duplicates.length > 0) {
        console.log('⚠️  Found duplicate barcodes. Clearing duplicates...');
        // Clear duplicate barcodes (keep first occurrence)
        for (const dup of duplicates) {
          const products = await db.all('SELECT id FROM products WHERE barcode = $1 ORDER BY id', [dup.barcode]);
          // Keep first, clear rest
          for (let i = 1; i < products.length; i++) {
            await db.run('UPDATE products SET barcode = NULL WHERE id = $1', [products[i].id]);
          }
        }
      }

      // Create unique index on barcode column (PostgreSQL partial index)
      await db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode 
        ON products(barcode) 
        WHERE barcode IS NOT NULL AND barcode != ''
      `);

      console.log('✅ Migration: Made barcode column unique in products table');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  down: async () => {
    try {
      await db.exec('DROP INDEX IF EXISTS idx_products_barcode');
      console.log('✅ Rollback: Removed unique constraint from barcode column');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
};
