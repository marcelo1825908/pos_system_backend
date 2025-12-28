// Migration: Remove UNIQUE constraint from payment_terminals.type column
const db = require('../config/database');

module.exports = {
  name: 'fix-payment-terminals-unique',
  up: async () => {
    console.log('Running migration: fix-payment-terminals-unique');
    
    try {
      // Check if table exists
      const tableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'payment_terminals'
      `);
      
      if (tableCheck.rows.length === 0) {
        console.log('✅ Table does not exist yet, no migration needed');
        return;
      }
      
      // Get existing data
      const existingTerminals = await db.all('SELECT * FROM payment_terminals');
      console.log(`📦 Found ${existingTerminals.length} existing terminals`);
      
      // Drop old table
      await db.exec('DROP TABLE IF EXISTS payment_terminals');
      console.log('🗑️  Dropped old table');
      
      // Create new table without UNIQUE constraint on type
      await db.exec(`
        CREATE TABLE payment_terminals (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(255) NOT NULL,
          connection_type VARCHAR(255) NOT NULL,
          connection_string TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created new table structure');
      
      // Restore data
      if (existingTerminals.length > 0) {
        for (const terminal of existingTerminals) {
          await db.run(`
            INSERT INTO payment_terminals (id, name, type, connection_type, connection_string, enabled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            terminal.id,
            terminal.name,
            terminal.type,
            terminal.connection_type,
            terminal.connection_string,
            terminal.enabled,
            terminal.created_at,
            terminal.updated_at
          ]);
        }
        console.log(`✅ Restored ${existingTerminals.length} terminals`);
      }
      
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
};
