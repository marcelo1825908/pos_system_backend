/**
 * Migration: Create cash_drawers table
 * Stores cash drawer configurations for POS system
 */

const db = require('../config/database');

module.exports = {
  name: '009-create-cash-drawers',
  up: async () => {
    console.log('Running migration: 009-create-cash-drawers');
    
    // Check if printers table exists
    const printersCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'printers'
    `);
    
    const printersExists = printersCheck.rows.length > 0;
    
    let sql;
    if (printersExists) {
      // Create with foreign key if printers table exists
      sql = `
        CREATE TABLE IF NOT EXISTS cash_drawers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          connection_type VARCHAR(255) NOT NULL DEFAULT 'printer',
          ip_address VARCHAR(255),
          port INTEGER,
          printer_id INTEGER,
          is_active INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL
        )
      `;
    } else {
      // Create without foreign key if printers table doesn't exist
      sql = `
        CREATE TABLE IF NOT EXISTS cash_drawers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          connection_type VARCHAR(255) NOT NULL DEFAULT 'printer',
          ip_address VARCHAR(255),
          port INTEGER,
          printer_id INTEGER,
          is_active INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      console.log('⚠️ printers table does not exist, creating cash_drawers without foreign key');
    }
    
    await db.exec(sql);
    console.log('✅ Created cash_drawers table');
  }
};
