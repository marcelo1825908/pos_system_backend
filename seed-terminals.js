// Load environment variables
// Look for .env in project root (two levels up from packages/server)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const fs = require('fs');
const db = require('./config/database');

// Create payment_terminals table if not exists
async function createTableIfNotExists() {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS payment_terminals (
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
  } catch (error) {
    console.error('Error creating payment_terminals table:', error.message);
    throw error;
  }
}

async function seedTerminals() {
  console.log('🌱 Starting terminal seeding...');

  // Create table if it doesn't exist
  await createTableIfNotExists();

  // Define terminal configurations to seed
  // Each terminal type has its config file path and metadata
  const terminalDefinitions = [
    {
      name: 'Cashmatic Terminal',
      type: 'cashmatic',
      connection_type: 'network',
      configPath: path.join(__dirname, 'config', 'cashmaticConfig.json'),
      requiredFields: ['ip', 'username', 'password']
    },
    {
      name: 'Payworld Terminal',
      type: 'payworld', // Also supports 'payword' and 'bancontact' aliases
      connection_type: 'network',
      configPath: path.join(__dirname, 'config', 'payworld.config.json'),
      requiredFields: ['ip', 'port', 'posId']
    },
    {
      name: 'Viva Wallet Terminal',
      type: 'viva',
      connection_type: 'api',
      configPath: path.join(__dirname, 'config', 'viva.config.json'),
      requiredFields: ['merchantId', 'terminalId'] // Client-side only for now
    }
  ];

  const terminals = [];

  // Process each terminal definition
  terminalDefinitions.forEach(def => {
    if (fs.existsSync(def.configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(def.configPath, 'utf8'));
        
        // Validate required fields
        const missingFields = def.requiredFields.filter(field => !config[field]);
        if (missingFields.length > 0) {
          console.warn(`⚠ ${def.name}: Missing required fields: ${missingFields.join(', ')}`);
          return;
        }
        
        terminals.push({
          name: def.name,
          type: def.type,
          connection_type: def.connection_type,
          connection_string: JSON.stringify(config),
          enabled: 1
        });
        console.log(`✓ ${def.name} config loaded`);
      } catch (error) {
        console.error(`✗ Error loading ${def.name} config:`, error.message);
      }
    } else {
      console.log(`ℹ ${def.name}: Config file not found at ${def.configPath} (skipping)`);
    }
  });

  // Insert or update terminals
  for (const terminal of terminals) {
    try {
      const existing = await db.get('SELECT id FROM payment_terminals WHERE type = $1', [terminal.type]);
      
      if (existing) {
        await db.run(`
          UPDATE payment_terminals 
          SET name = $1, connection_type = $2, connection_string = $3, enabled = $4, updated_at = CURRENT_TIMESTAMP
          WHERE type = $5
        `, [
          terminal.name,
          terminal.connection_type,
          terminal.connection_string,
          terminal.enabled,
          terminal.type
        ]);
        console.log(`✓ Updated ${terminal.name}`);
      } else {
        await db.run(`
          INSERT INTO payment_terminals (name, type, connection_type, connection_string, enabled)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          terminal.name,
          terminal.type,
          terminal.connection_type,
          terminal.connection_string,
          terminal.enabled
        ]);
        console.log(`✓ Created ${terminal.name}`);
      }
    } catch (error) {
      console.error(`✗ Error seeding ${terminal.name}:`, error.message);
    }
  }

  console.log('✅ Terminal seeding completed!');
}

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await seedTerminals();
      process.exit(0);
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = seedTerminals;
