const db = require('../config/database');

/**
 * Migration: Add member_id field to members table
 * This adds a unique member identifier separate from the auto-increment id
 */
module.exports = {
  name: '005-add-member-id',
  
  up: async () => {
    console.log('Running migration: Add member_id to members table');
    
    try {
      // Check if members table exists
      const tableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'members'
      `);
      
      if (tableCheck.rows.length === 0) {
        console.log('⚠️ members table does not exist yet, skipping migration');
        return;
      }
      
      // Check if member_id column already exists
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'members' AND column_name = 'member_id'
      `);
      
      if (columnCheck.rows.length > 0) {
        console.log('member_id column already exists, skipping migration');
        return;
      }

      // Add member_id column without UNIQUE constraint first
      await db.exec(`
        ALTER TABLE members ADD COLUMN member_id VARCHAR(255)
      `);

      // Generate member_id for existing members
      const existingMembers = await db.all('SELECT id FROM members WHERE member_id IS NULL');
      
      if (existingMembers.length > 0) {
        console.log(`Generating member_id for ${existingMembers.length} existing members`);
        
        for (let index = 0; index < existingMembers.length; index++) {
          const member = existingMembers[index];
          const memberId = String(index + 1).padStart(4, '0'); // 0001, 0002, etc.
          await db.run('UPDATE members SET member_id = $1 WHERE id = $2', [memberId, member.id]);
        }
      }

      // Now recreate the table with UNIQUE constraint
      await db.exec(`
        CREATE TABLE members_new (
          id SERIAL PRIMARY KEY,
          member_id VARCHAR(255) UNIQUE,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(255) DEFAULT '',
          email VARCHAR(255) DEFAULT '',
          address TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.exec(`
        INSERT INTO members_new (id, member_id, full_name, phone, email, address, created_at, updated_at)
        SELECT id, member_id, full_name, phone, email, address, created_at, updated_at FROM members
      `);

      await db.exec('DROP TABLE members');
      await db.exec('ALTER TABLE members_new RENAME TO members');

      console.log('Migration completed: member_id added successfully with UNIQUE constraint');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async () => {
    console.log('Rolling back migration: Remove member_id from members table');
    
    try {
      // PostgreSQL supports DROP COLUMN, but we'll recreate table for consistency
      await db.exec(`
        CREATE TABLE members_backup (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(255) DEFAULT '',
          email VARCHAR(255) DEFAULT '',
          address TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.exec(`
        INSERT INTO members_backup (id, full_name, phone, email, address, created_at, updated_at)
        SELECT id, full_name, phone, email, address, created_at, updated_at FROM members
      `);

      await db.exec('DROP TABLE members');
      await db.exec('ALTER TABLE members_backup RENAME TO members');

      console.log('Rollback completed: member_id removed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
};
