/**
 * Migration: Add is_main column to printers table
 * Allows marking one printer as the main/default printer
 */

const db = require('../config/database');

module.exports = {
  name: '20251216000000-add-is-main-to-printers',
  up: async () => {
    console.log('Checking if is_main column exists in printers table...');
    
    // Check if printers table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'printers'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️ printers table does not exist yet, skipping migration');
      return;
    }
    
    // Check if column already exists
    try {
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'printers' AND column_name = 'is_main'
      `);
      
      if (columnCheck.rows.length > 0) {
        console.log('✅ is_main column already exists, skipping...');
        return;
      }
    } catch (err) {
      // Continue to try adding the column
    }
    
    console.log('Adding is_main column to printers table...');
    
    try {
      // Add is_main column with default value 0 (false)
      await db.exec(`
        ALTER TABLE printers ADD COLUMN is_main INTEGER DEFAULT 0
      `);
      
      console.log('✅ is_main column added successfully');
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        throw err;
      }
      console.log('⚠️ is_main column already exists');
    }
  }
};
