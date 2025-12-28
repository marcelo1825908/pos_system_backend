const db = require('../config/database');

module.exports = {
  name: '20250102000000_add_password_to_terminals',
  up: async () => {
    console.log('Running migration: add password column to terminals table');
    
    try {
      await db.exec(`ALTER TABLE terminals ADD COLUMN password VARCHAR(255) DEFAULT ''`);
      console.log('✅ Password column added to terminals table');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('⚠️ Password column already exists in terminals table');
      } else {
        throw err;
      }
    }
  },
  down: async () => {
    console.log('Running rollback: remove password column from terminals');
    // PostgreSQL supports dropping columns
    try {
      await db.exec(`ALTER TABLE terminals DROP COLUMN password`);
      console.log('✅ Password column removed from terminals table');
    } catch (err) {
      console.log('⚠️ Error removing password column:', err.message);
    }
  }
};

