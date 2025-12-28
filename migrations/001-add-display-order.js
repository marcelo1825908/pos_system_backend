const db = require('../config/database');

module.exports = {
  name: '001-add-display-order',
  up: async () => {
    console.log('Running migration: 001-add-display-order');
    
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
