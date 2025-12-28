const db = require('../config/database');

const name = '20251216000000_add_weight_fields_to_products';

async function up() {
  console.log('Adding weight-related fields to products table...');
  
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
  
  const columns = [
    { name: 'is_weight_based', type: 'INTEGER DEFAULT 0' },
    { name: 'weight_unit', type: "VARCHAR(10) DEFAULT 'kg'" },
    { name: 'price_per_unit', type: 'DECIMAL(10, 2) DEFAULT 0' },
    { name: 'minimum_weight', type: 'DECIMAL(10, 2) DEFAULT 0' },
    { name: 'maximum_weight', type: 'DECIMAL(10, 2) DEFAULT 0' },
    { name: 'tare_weight', type: 'DECIMAL(10, 2) DEFAULT 0' }
  ];

  for (const col of columns) {
    try {
      await db.exec(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Added ${col.name} column`);
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.error(`❌ Failed to add ${col.name} column:`, err.message);
      }
    }
  }

  console.log('✅ Weight fields migration completed');
}

async function down() {
  console.log('Removing weight-related fields from products table...');
  
  const columns = ['is_weight_based', 'weight_unit', 'price_per_unit', 'minimum_weight', 'maximum_weight', 'tare_weight'];
  
  for (const col of columns) {
    try {
      await db.exec(`ALTER TABLE products DROP COLUMN ${col}`);
      console.log(`✅ Removed ${col} column`);
    } catch (err) {
      console.log(`⚠️  Error removing ${col} column:`, err.message);
    }
  }
}

module.exports = { name, up, down };