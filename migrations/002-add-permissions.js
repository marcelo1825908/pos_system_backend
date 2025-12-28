const db = require('../config/database');

module.exports = {
  name: '002-add-permissions',
  up: async () => {
    console.log('Running migration: 002-add-permissions');
    
    // Check if permissions column exists
    try {
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'permissions'
      `);
      
      if (columnCheck.rows.length === 0) {
        await db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'`);
        console.log('✅ Added permissions column to users table');
      } else {
        console.log('✓ Permissions column already exists');
      }
    } catch (err) {
      // Column might already exist, try to add it anyway
      try {
        await db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'`);
        console.log('✅ Added permissions column to users table');
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
          console.log('Note: permissions column may already exist');
        }
      }
    }

    // Update existing users to have empty permissions array if null
    const updateResult = await db.run(`
      UPDATE users 
      SET permissions = '[]' 
      WHERE permissions IS NULL OR permissions = ''
    `);

    if (updateResult.changes > 0) {
      console.log(`✅ Updated ${updateResult.changes} users with default permissions`);
    }
  }
};
