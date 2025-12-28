const db = require('../config/database');

/**
 * Migration: Consolidate first_name and name into full_name
 * This migration combines the first_name and name columns into a single full_name column
 */
const name = '004-consolidate-member-name';

async function up() {
  console.log('Running migration: 004-consolidate-member-name');
  
  try {
    // Check if table has old schema (first_name and name columns)
    const columns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'members'
    `);
    
    const columnNames = columns.rows.map(row => row.column_name);
    const hasFirstName = columnNames.includes('first_name');
    const hasName = columnNames.includes('name');
    const hasFullName = columnNames.includes('full_name');
    
    // If table already has full_name and no first_name/name, migration already done
    if (hasFullName && !hasFirstName && !hasName) {
      console.log('Migration 004-consolidate-member-name already applied, skipping');
      return;
    }
    
    // If table has old schema, migrate it
    if (hasFirstName && hasName) {
      // Add full_name column if it doesn't exist
      if (!hasFullName) {
        await db.exec(`ALTER TABLE members ADD COLUMN full_name VARCHAR(255)`);
      }
      
      // Populate full_name with combined first_name and name (PostgreSQL uses || for concatenation)
      await db.exec(`UPDATE members SET full_name = first_name || ' ' || name WHERE full_name IS NULL OR full_name = ''`);
      
      // Create new table with desired schema
      await db.exec(`
        CREATE TABLE members_new (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(255) DEFAULT '',
          email VARCHAR(255) DEFAULT '',
          address TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Copy data to new table
      await db.exec(`
        INSERT INTO members_new (id, full_name, phone, email, address, created_at, updated_at)
        SELECT id, full_name, phone, email, address, created_at, updated_at
        FROM members
      `);
      
      // Drop old table
      await db.exec(`DROP TABLE members`);
      
      // Rename new table
      await db.exec(`ALTER TABLE members_new RENAME TO members`);
      
      console.log('Migration 004-consolidate-member-name completed successfully');
    } else {
      console.log('Migration 004-consolidate-member-name: Table schema is unexpected, skipping');
    }
  } catch (error) {
    console.error('Migration 004-consolidate-member-name failed:', error);
    throw error;
  }
}

async function down() {
  console.log('Rolling back migration: 004-consolidate-member-name');
  
  try {
    // Create table with old schema
    await db.exec(`
      CREATE TABLE members_old (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        phone VARCHAR(255) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Split full_name back into first_name and name
    const members = await db.all('SELECT * FROM members');
    
    for (const member of members) {
      const nameParts = member.full_name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || firstName;
      
      await db.run(`
        INSERT INTO members_old (id, name, first_name, phone, email, address, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        member.id,
        lastName,
        firstName,
        member.phone,
        member.email,
        member.address,
        member.created_at,
        member.updated_at
      ]);
    }
    
    // Drop new table
    await db.exec(`DROP TABLE members`);
    
    // Rename old table
    await db.exec(`ALTER TABLE members_old RENAME TO members`);
    
    console.log('Rollback 004-consolidate-member-name completed successfully');
  } catch (error) {
    console.error('Rollback 004-consolidate-member-name failed:', error);
    throw error;
  }
}

module.exports = { name, up, down };
