// Combined seed script - runs all seeders
// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runAllSeeds() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    // Seed payment terminals
    console.log('📦 Seeding payment terminals...');
    const seedTerminals = require('./seed-terminals');
    await seedTerminals();
    console.log('✅ Payment terminals seeded successfully\n');
    
    console.log('🎉 All seeds completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllSeeds();
}

module.exports = { runAllSeeds };

