#!/usr/bin/env node

/**
 * Helper script to create .env file for PostgreSQL configuration
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createEnvFile() {
  console.log('📝 PostgreSQL Configuration Setup\n');
  console.log('This script will help you create a .env file with your PostgreSQL credentials.\n');

  const envPath = path.join(__dirname, '..', '..', '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return;
    }
  }

  const dbHost = await question('PostgreSQL Host [localhost]: ') || 'localhost';
  const dbPort = await question('PostgreSQL Port [5432]: ') || '5432';
  const dbName = await question('Database Name [pos_desktop]: ') || 'pos_desktop';
  const dbUser = await question('PostgreSQL User [postgres]: ') || 'postgres';
  const dbPassword = await question('PostgreSQL Password: ');
  
  if (!dbPassword) {
    console.error('\n❌ Password is required!');
    rl.close();
    return;
  }

  const envContent = `# PostgreSQL Database Configuration
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}

# Node Environment
NODE_ENV=development
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅ Created .env file at: ${envPath}`);
    console.log('\nNext steps:');
    console.log('1. Make sure PostgreSQL is running');
    console.log(`2. Create the database: CREATE DATABASE ${dbName};`);
    console.log('3. Run migrations: npm run migrate');
  } catch (error) {
    console.error('\n❌ Error creating .env file:', error.message);
  }

  rl.close();
}

createEnvFile();

