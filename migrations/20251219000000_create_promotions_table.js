const db = require('../config/database');

const name = '20251219000000_create_promotions_table';

async function up() {
  console.log('Creating promotions table...');
  
  // Check if products table exists
  const productsCheck = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'products'
  `);
  
  const productsExists = productsCheck.rows.length > 0;
  
  let sql;
  if (productsExists) {
    // Create with foreign key if products table exists
    sql = `
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        product_id INTEGER NOT NULL,
        discount_type VARCHAR(255) NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `;
  } else {
    // Create without foreign key if products table doesn't exist
    sql = `
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        product_id INTEGER NOT NULL,
        discount_type VARCHAR(255) NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('⚠️ products table does not exist, creating promotions without foreign key');
  }
  
  await db.exec(sql);
  console.log('✅ Promotions table created successfully');
}

async function down() {
  console.log('Dropping promotions table...');
  await db.exec('DROP TABLE IF EXISTS promotions');
  console.log('✅ Promotions table dropped');
}

module.exports = { name, up, down };
