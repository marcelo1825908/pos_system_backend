const db = require('../config/database');

module.exports = {
  name: '003-create-product-subproduct-junction',
  up: async () => {
    console.log('Running migration: 003-create-product-subproduct-junction');
    
    // Check if sub_products and products tables exist
    const subProductsCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sub_products'
    `);
    
    const productsCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'products'
    `);
    
    const subProductsExists = subProductsCheck.rows.length > 0;
    const productsExists = productsCheck.rows.length > 0;
    
    // Create the junction table with or without foreign keys depending on what exists
    if (subProductsExists && productsExists) {
      // Both tables exist, create with foreign keys
      await db.exec(`
        CREATE TABLE IF NOT EXISTS product_sub_products (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          sub_product_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY(sub_product_id) REFERENCES sub_products(id) ON DELETE CASCADE,
          UNIQUE(product_id, sub_product_id)
        )
      `);
      console.log('✅ Junction table created successfully with foreign keys');
    } else {
      // One or both tables don't exist, create without foreign keys
      await db.exec(`
        CREATE TABLE IF NOT EXISTS product_sub_products (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          sub_product_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, sub_product_id)
        )
      `);
      console.log('✅ Junction table created successfully (without foreign keys - referenced tables not found)');
      
      if (!subProductsExists) {
        console.log('⚠️ sub_products table does not exist yet, skipping data migration');
        return;
      }
    }

    // Migrate existing data from sub_products.product_id to junction table
    if (subProductsExists) {
      try {
        const existingRelations = await db.all(`
          SELECT id, product_id FROM sub_products WHERE product_id IS NOT NULL
        `);

        if (existingRelations.length > 0) {
          // Use ON CONFLICT DO NOTHING instead of INSERT OR IGNORE
          for (const relation of existingRelations) {
            try {
              await db.run(`
                INSERT INTO product_sub_products (product_id, sub_product_id)
                VALUES ($1, $2)
                ON CONFLICT (product_id, sub_product_id) DO NOTHING
              `, [relation.product_id, relation.id]);
            } catch (err) {
              // Ignore duplicate errors
              if (!err.message.includes('duplicate') && err.code !== '23505') {
                console.error('Error migrating relation:', err);
              }
            }
          }
          console.log(`✅ Migrated ${existingRelations.length} existing relationships to junction table`);
        }
      } catch (err) {
        console.log('⚠️ Could not migrate existing data (table may be empty):', err.message);
      }
    }
  }
};
