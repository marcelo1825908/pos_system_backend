// Load environment variables from .env file
// Look for .env in project root (two levels up from packages/server)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('./config/database');
const { Pool } = require('pg');
const fs = require('fs');

// Helper function to create database if it doesn't exist
async function ensureDatabaseExists() {
  // Parse connection info
  let adminConfig;
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const dbName = url.pathname.slice(1);
    // Connect to 'postgres' database to create the target database
    adminConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: 'postgres', // Connect to default postgres database
      user: url.username,
      password: url.password,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
    const targetDbName = dbName;
    
    const adminPool = new Pool(adminConfig);
    try {
      // Check if database exists
      const result = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [targetDbName]
      );
      
      if (result.rows.length === 0) {
        console.log(`📦 Creating database "${targetDbName}"...`);
        await adminPool.query(`CREATE DATABASE "${targetDbName}"`);
        console.log(`✅ Database "${targetDbName}" created successfully`);
      } else {
        console.log(`✅ Database "${targetDbName}" already exists`);
      }
    } finally {
      await adminPool.end();
    }
  } else {
    const dbName = process.env.DB_NAME || 'pos_desktop';
    adminConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: 'postgres', // Connect to default postgres database
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
    
    const adminPool = new Pool(adminConfig);
    try {
      // Check if database exists
      const result = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );
      
      if (result.rows.length === 0) {
        console.log(`📦 Creating database "${dbName}"...`);
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Database "${dbName}" created successfully`);
      } else {
        console.log(`✅ Database "${dbName}" already exists`);
      }
    } finally {
      await adminPool.end();
    }
  }
}

// Create migrations tracking table
async function initializeMigrationsTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get all executed migrations
async function getExecutedMigrations() {
  const rows = await db.all('SELECT name FROM migrations');
  return rows.map(row => row.name);
}

// Mark migration as executed
async function markMigrationExecuted(name) {
  await db.run('INSERT INTO migrations (name) VALUES ($1)', [name]);
}

// Run all pending migrations
async function runMigrations() {
  console.log('🔄 Checking for pending migrations...');
  
  // Ensure database exists before running migrations
  try {
    await ensureDatabaseExists();
  } catch (error) {
    // If we can't create the database, try to continue anyway
    // (database might already exist or we might not have permissions)
    console.log('⚠️  Could not ensure database exists, continuing anyway...');
  }
  
  // Initialize migrations table
  await initializeMigrationsTable();
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const mosqueMigrationsDir = path.join(__dirname, 'mosque', 'migrations');
  const executedMigrations = await getExecutedMigrations();
  
  // Get all migration files from both directories
  let migrationFiles = [];
  
  // Main migrations
  if (fs.existsSync(migrationsDir)) {
    const mainMigrations = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => ({ file, dir: migrationsDir }));
    migrationFiles.push(...mainMigrations);
  }
  
  // Mosque migrations
  if (fs.existsSync(mosqueMigrationsDir)) {
    const mosqueMigrations = fs.readdirSync(mosqueMigrationsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => ({ file, dir: mosqueMigrationsDir }));
    migrationFiles.push(...mosqueMigrations);
  }
  
  // Sort by filename to ensure migrations run in order
  migrationFiles.sort((a, b) => a.file.localeCompare(b.file));

  let pendingCount = 0;

  for (const { file, dir } of migrationFiles) {
    const migrationPath = path.join(dir, file);
    const migration = require(migrationPath);
    
    if (!executedMigrations.includes(migration.name)) {
      console.log(`\n📦 Running migration: ${migration.name}`);
      
      try {
        // Check if migration.up is async
        if (migration.up.constructor.name === 'AsyncFunction') {
          await migration.up();
        } else {
          migration.up();
        }
        await markMigrationExecuted(migration.name);
        console.log(`✅ Migration ${migration.name} completed successfully`);
        pendingCount++;
      } catch (error) {
        console.error(`❌ Migration ${migration.name} failed:`, error.message);
        throw error;
      }
    }
  }

  if (pendingCount === 0) {
    console.log('✅ All migrations are up to date');
  } else {
    console.log(`\n✅ Successfully ran ${pendingCount} migration(s)`);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await runMigrations();
      console.log('\n🎉 Migration process completed');
      // Give time for any pending queries to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      process.exit(0);
    } catch (error) {
      if (error.code === '28P01') {
        console.error('\n❌ PostgreSQL Authentication Failed');
        console.error('\nTo fix this:');
        console.error('1. Create a .env file in the project root (f:\\shgfhdfh\\pos-desktop-app\\.env)');
        console.error('2. Add your PostgreSQL credentials:');
        console.error('   DB_HOST=localhost');
        console.error('   DB_PORT=5432');
        console.error('   DB_NAME=pos_desktop');
        console.error('   DB_USER=postgres');
        console.error('   DB_PASSWORD=your_actual_postgres_password');
        console.error('\n3. Make sure PostgreSQL is installed and running');
        console.error('4. Create the database: CREATE DATABASE pos_desktop;');
        console.error('\nSee packages/server/POSTGRESQL_SETUP.md for detailed instructions.\n');
      } else if (error.code === '3D000' || error.message.includes('does not exist')) {
        console.error('\n❌ Database does not exist');
        console.error('\nThe database needs to be created first.');
        if (process.env.DATABASE_URL) {
          console.error('Railway/Heroku: The database should be created automatically by your hosting provider.');
          console.error('If this error persists, check your DATABASE_URL environment variable.');
        } else {
          console.error('\nTo create the database:');
          console.error('1. Connect to PostgreSQL: psql -U postgres');
          console.error(`2. Run: CREATE DATABASE ${process.env.DB_NAME || 'pos_desktop'};`);
        }
        console.error('\nError details:', error.message);
      } else if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
        console.error('\n❌ Database connection was reset');
        console.error('This might happen if:');
        console.error('1. The database server closed the connection');
        console.error('2. There was a network issue');
        console.error('3. The migration took too long');
        console.error('\nTry running the migration again. If it persists, check your PostgreSQL server logs.');
        console.error('\nError details:', error.message);
      } else {
        console.error('\n❌ Migration process failed:', error.message);
        if (error.stack) {
          console.error('\nStack trace:', error.stack);
        }
      }
      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      process.exit(1);
    }
  })();
}

module.exports = { runMigrations };
