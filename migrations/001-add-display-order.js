const db = require('../config/database');

module.exports = {
  name: '001-add-display-order',
  up: async () => {
    console.log('Running migration: 001-add-display-order');
    
    // Check if categories table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'categories'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️ categories table does not exist yet, skipping migration');
      return;
    }
    
    // Check if display_order column already exists
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' AND column_name = 'display_order'
    `);
    
    if (columnCheck.rows.length === 0) {
      // Add display_order column if it doesn't exist
      await db.exec('ALTER TABLE categories ADD COLUMN display_order INTEGER DEFAULT 0');
      console.log('✅ Added display_order column to categories table');
    }
    
    // Get all categories ordered by ID
    const categories = await db.all('SELECT id FROM categories ORDER BY id ASC');
    
    if (categories.length === 0) {
      console.log('No categories to migrate');
      return;
    }

    // Update each category with its display_order based on current position
    for (let index = 0; index < categories.length; index++) {
      const category = categories[index];
      const displayOrder = index + 1;
      await db.run('UPDATE categories SET display_order = $1 WHERE id = $2', [displayOrder, category.id]);
    }

    console.log(`✅ Migrated ${categories.length} categories with display_order`);
  }
};
