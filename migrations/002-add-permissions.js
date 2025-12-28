const db = require('../config/database');

module.exports = {
  name: '002-add-permissions',
  up: async () => {
    console.log('Running migration: 002-add-permissions');
    
    // Check if users table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'users'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️ users table does not exist yet, creating it...');
      // Create users table if it doesn't exist
      await db.exec(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(255) DEFAULT 'employee',
          permissions TEXT DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ users table created with permissions column');
      return;
    }
    
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
    try {
      const updateResult = await db.run(`
        UPDATE users 
        SET permissions = '[]' 
        WHERE permissions IS NULL OR permissions = ''
      `);

      if (updateResult.changes > 0) {
        console.log(`✅ Updated ${updateResult.changes} users with default permissions`);
      }
    } catch (err) {
      // If update fails, it's okay - might be no users yet
      console.log('Note: Could not update users (table might be empty)');
    }
  }
};
