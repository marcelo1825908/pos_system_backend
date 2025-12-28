// Load environment variables from .env file
// Look for .env in project root (two levels up from packages/server/config)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { Pool } = require('pg');

// Parse DATABASE_URL if provided (Railway, Heroku, etc.)
let poolConfig;
if (process.env.DATABASE_URL) {
  // Parse DATABASE_URL format: postgresql://user:password@host:port/database
  const url = new URL(process.env.DATABASE_URL);
  poolConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // Remove leading '/'
    user: url.username,
    password: url.password,
    ssl: process.env.DATABASE_URL.includes('sslmode=require') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    allowExitOnIdle: false,
  };
} else {
  // Use individual environment variables
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pos_desktop',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    allowExitOnIdle: false,
  };
}

// PostgreSQL connection configuration
const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Only log non-authentication errors to avoid duplicate messages
  // Authentication errors are expected if PostgreSQL isn't configured yet
  if (err.code !== '28P01') {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
  }
  // Don't exit on error - let the application handle it
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a single row
const get = async (text, params) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

// Helper function to get all rows
const all = async (text, params) => {
  const result = await query(text, params);
  return result.rows;
};

// Helper function to execute a query (for INSERT, UPDATE, DELETE)
const run = async (text, params) => {
  const result = await query(text, params);
  // For INSERT with RETURNING, get the id from the first row
  const lastInsertRowid = result.rows[0]?.id || null;
  return {
    lastInsertRowid,
    changes: result.rowCount || 0,
    rowCount: result.rowCount || 0
  };
};

// Helper function to execute multiple statements (for migrations)
const exec = async (sql) => {
  let client;
  try {
    client = await pool.connect();
    await client.query(sql);
  } catch (error) {
    // Re-throw the error so callers can handle it
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Initialize database schema
// NOTE: This is a fallback for basic table creation. Migrations should handle schema creation.
const initializeDatabase = async () => {
  try {
    // Skip initialization if we're running migrations (migrations handle table creation)
    if (process.argv && process.argv[1] && process.argv[1].includes('migrate.js')) {
      return;
    }

    // Create users table
    await exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        pincode VARCHAR(255) NOT NULL,
        social_security VARCHAR(255),
        identification VARCHAR(255),
        role VARCHAR(255) DEFAULT 'User',
        avatar_color VARCHAR(255) DEFAULT '#3b82f6',
        permissions TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create categories table
    await exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        next_course INTEGER DEFAULT 0,
        in_web_shop INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        is_visible INTEGER DEFAULT 1
      )
    `);

    // Create groups table FIRST (before sub_products that reference it)
    await exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_visible INTEGER DEFAULT 0
      )
    `);

    // Create products table
    await exec(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER,
        name VARCHAR(255) NOT NULL,
        button_name VARCHAR(255),
        production_name VARCHAR(255),
        price DECIMAL(10, 2) DEFAULT 0,
        vat_takeout DECIMAL(10, 2) DEFAULT 0,
        vat_eat_in DECIMAL(10, 2) DEFAULT 0,
        barcode VARCHAR(255),
        category_id INTEGER,
        addition_type VARCHAR(255),
        display_index INTEGER DEFAULT 0,
        in_web_shop INTEGER DEFAULT 0,
        printer1 VARCHAR(255),
        printer2 VARCHAR(255),
        printer3 VARCHAR(255),
        image TEXT,
        color VARCHAR(255) DEFAULT '#3b82f6',
        price_vat_inc DECIMAL(10, 2) DEFAULT 0,
        sub_product_group INTEGER DEFAULT 0,
        is_weight_based INTEGER DEFAULT 0,
        weight_unit VARCHAR(10) DEFAULT 'kg',
        price_per_unit DECIMAL(10, 2) DEFAULT 0,
        minimum_weight DECIMAL(10, 2) DEFAULT 0,
        maximum_weight DECIMAL(10, 2) DEFAULT 0,
        tare_weight DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sub_products table (after groups and products)
    await exec(`
      CREATE TABLE IF NOT EXISTS sub_products (
        id SERIAL PRIMARY KEY,
        group_id INTEGER,
        product_id INTEGER,
        name VARCHAR(255) NOT NULL,
        button_name VARCHAR(255),
        production_name VARCHAR(255),
        price DECIMAL(10, 2) DEFAULT 0,
        vat_takeout DECIMAL(10, 2) DEFAULT 0,
        vat_eat_in DECIMAL(10, 2) DEFAULT 0,
        barcode VARCHAR(255),
        category_id INTEGER,
        addition_type VARCHAR(255),
        display_index INTEGER DEFAULT 0,
        in_web_shop INTEGER DEFAULT 0,
        printer1 VARCHAR(255),
        printer2 VARCHAR(255),
        printer3 VARCHAR(255),
        image TEXT,
        color VARCHAR(255) DEFAULT '#3b82f6',
        price_vat_inc DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rooms table
    await exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        total_table INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pr_table table (without foreign keys first to avoid circular dependency)
    const prTableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'pr_table'
    `);
    
    if (prTableCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE pr_table (
          id SERIAL PRIMARY KEY,
          table_no VARCHAR(255) NOT NULL,
          room_id INTEGER,
          order_id INTEGER,
          status VARCHAR(255) DEFAULT 'available',
          description TEXT,
          customer_name VARCHAR(255),
          waiter_name VARCHAR(255),
          table_size INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Create orders table (without foreign keys first to avoid circular dependency)
    const ordersTableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'orders'
    `);
    
    if (ordersTableCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          tax DECIMAL(10, 2) DEFAULT 0,
          status VARCHAR(255) DEFAULT 'pending',
          note TEXT,
          gross_total DECIMAL(10, 2) DEFAULT 0,
          net_total DECIMAL(10, 2) DEFAULT 0,
          discount DECIMAL(10, 2) DEFAULT 0,
          table_id INTEGER,
          order_no VARCHAR(255),
          order_type VARCHAR(255) DEFAULT 'horeca',
          device_id VARCHAR(255),
          employee_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        )
      `);
    }

    // Add foreign keys after both tables exist (handle circular dependency)
    try {
      // Check if foreign key constraints already exist
      const fkCheck1 = await query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'pr_table' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%order_id%'
      `);
      
      if (fkCheck1.rows.length === 0 && ordersTableCheck.rows.length > 0) {
        await exec(`
          ALTER TABLE pr_table 
          ADD CONSTRAINT fk_pr_table_order_id 
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
        `);
      }
      
      const fkCheck2 = await query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'pr_table' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%room_id%'
      `);
      
      if (fkCheck2.rows.length === 0) {
        const roomsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'rooms'
        `);
        
        if (roomsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE pr_table 
            ADD CONSTRAINT fk_pr_table_room_id 
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
          `);
        }
      }
      
      const fkCheck3 = await query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'orders' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%table_id%'
      `);
      
      if (fkCheck3.rows.length === 0 && prTableCheck.rows.length > 0) {
        await exec(`
          ALTER TABLE orders 
          ADD CONSTRAINT fk_orders_table_id 
          FOREIGN KEY (table_id) REFERENCES pr_table(id) ON DELETE SET NULL
        `);
      }
    } catch (err) {
      // Foreign keys might already exist or tables don't exist yet - that's OK
      // Migrations will handle proper table creation
    }

    // Create order_details table (without foreign keys first)
    const orderDetailsCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'order_details'
    `);
    
    if (orderDetailsCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE order_details (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          qty DECIMAL(10, 2) DEFAULT 0,
          total DECIMAL(10, 2) DEFAULT 0,
          notes TEXT,
          discount DECIMAL(10, 2) DEFAULT 0,
          weight DECIMAL(10, 2) DEFAULT 0,
          weight_unit VARCHAR(10) DEFAULT 'kg',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add foreign keys after tables exist
      try {
        if (ordersTableCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE order_details 
            ADD CONSTRAINT fk_order_details_order_id 
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
          `);
        }
        
        const productsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'products'
        `);
        
        if (productsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE order_details 
            ADD CONSTRAINT fk_order_details_product_id 
            FOREIGN KEY (product_id) REFERENCES products(id)
          `);
        }
      } catch (err) {
        // Foreign keys might already exist - that's OK
      }
    }

    // Create product_sub_products junction table (without foreign keys first)
    const productSubProductsCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'product_sub_products'
    `);
    
    if (productSubProductsCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE product_sub_products (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          sub_product_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_id, sub_product_id)
        )
      `);
      
      // Add foreign keys after tables exist
      try {
        const productsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'products'
        `);
        
        const subProductsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'sub_products'
        `);
        
        if (productsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE product_sub_products 
            ADD CONSTRAINT fk_product_sub_products_product_id 
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          `);
        }
        
        if (subProductsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE product_sub_products 
            ADD CONSTRAINT fk_product_sub_products_sub_product_id 
            FOREIGN KEY (sub_product_id) REFERENCES sub_products(id) ON DELETE CASCADE
          `);
        }
      } catch (err) {
        // Foreign keys might already exist - that's OK
      }
    }

    // Create printers table
    await exec(`
      CREATE TABLE IF NOT EXISTS printers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        connection_string TEXT,
        is_main INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customers table
    await exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory table (without foreign keys first)
    const inventoryCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'inventory'
    `);
    
    if (inventoryCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE inventory (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          qty DECIMAL(10, 2) DEFAULT 0
        )
      `);
      
      // Add foreign key after products table exists
      try {
        const productsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'products'
        `);
        
        if (productsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE inventory 
            ADD CONSTRAINT fk_inventory_product_id 
            FOREIGN KEY (product_id) REFERENCES products(id)
          `);
        }
      } catch (err) {
        // Foreign key might already exist - that's OK
      }
    }

    // Create promotions table (without foreign keys first)
    const promotionsCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'promotions'
    `);
    
    if (promotionsCheck.rows.length === 0) {
      await exec(`
        CREATE TABLE promotions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          product_id INTEGER,
          discount_type VARCHAR(255) NOT NULL DEFAULT 'percentage',
          discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add foreign key after products table exists
      try {
        const productsCheck = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'products'
        `);
        
        if (productsCheck.rows.length > 0) {
          await exec(`
            ALTER TABLE promotions 
            ADD CONSTRAINT fk_promotions_product_id 
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          `);
        }
      } catch (err) {
        // Foreign key might already exist - that's OK
      }
    }

    // Create z_reports table (for backward compatibility)
    await exec(`
      CREATE TABLE IF NOT EXISTS z_reports (
        id SERIAL PRIMARY KEY,
        report_date DATE NOT NULL UNIQUE,
        report_data TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create members table
    await exec(`
      CREATE TABLE IF NOT EXISTS members (
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

    // Create terminals table
    await exec(`
      CREATE TABLE IF NOT EXISTS terminals (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(255) DEFAULT 'pending',
        password VARCHAR(255) DEFAULT '',
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payment_terminals table
    await exec(`
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

    // Create member_fees table
    await exec(`
      CREATE TABLE IF NOT EXISTS member_fees (
        id SERIAL PRIMARY KEY,
        fee_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rental_charges table
    await exec(`
      CREATE TABLE IF NOT EXISTS rental_charges (
        id SERIAL PRIMARY KEY,
        charge_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create mosque_payments table
    await exec(`
      CREATE TABLE IF NOT EXISTS mosque_payments (
        id SERIAL PRIMARY KEY,
        member_id INTEGER,
        payment_type VARCHAR(255) NOT NULL,
        payment_method VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        goal VARCHAR(255),
        rental_start_date TIMESTAMP,
        rental_end_date TIMESTAMP,
        rental_start_hour INTEGER,
        rental_end_hour INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE SET NULL
      )
    `);

    // Create trigger to update updated_at timestamp
    await exec(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for orders table (only if table exists)
    try {
      const ordersTableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'orders'
      `);
      
      if (ordersTableCheck.rows.length > 0) {
        await exec(`
          DROP TRIGGER IF EXISTS update_orders_timestamp ON orders;
          CREATE TRIGGER update_orders_timestamp
          BEFORE UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        `);
      }
    } catch (err) {
      // Orders table doesn't exist yet, skip trigger creation
      // This is OK - migrations will create it later
    }

    // Insert default admin user if no users exist
    try {
      const usersTableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      
      if (usersTableCheck.rows.length > 0) {
        const userCount = await get('SELECT COUNT(*) as count FROM users');
        if (parseInt(userCount.count) === 0) {
          // Check what columns exist in users table
          const columns = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
          `);
          const columnNames = columns.rows.map(row => row.column_name);
          
          // Use the correct columns based on what exists
          if (columnNames.includes('username') && columnNames.includes('password')) {
            await run(`
              INSERT INTO users (username, password, role)
              VALUES ($1, $2, $3)
            `, ['admin', 'admin123', 'admin']);
            console.log('✅ Default admin user created');
          } else if (columnNames.includes('name')) {
            // Legacy format
            await run(`
              INSERT INTO users (name, pincode, social_security, identification, role, avatar_color)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, ['Super Admin', '1234', '', '', 'Super Admin', '#ef4444']);
            console.log('✅ Default admin user created (legacy format)');
          }
        }
      }
    } catch (err) {
      // Users table might not exist yet or insert failed - that's OK
      console.log('Note: Could not create default admin user (this is OK if users table structure differs)');
    }

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    // Don't throw - just log the error
    // This allows the server to start even if PostgreSQL isn't configured yet
    if (error.code === '28P01' || error.code === 'ECONNREFUSED' || error.code === '42P01') {
      console.error('⚠️  Database initialization error (this is OK if PostgreSQL is not set up yet):', error.message);
    } else {
      console.error('❌ Error initializing database:', error.message);
    }
    // Don't re-throw - allow server to continue
  }
};

// Initialize database on module load (don't block exports if it fails)
// This runs asynchronously and won't crash the server if PostgreSQL isn't configured
// Skip if running migrations (migrations handle schema creation)
if (!(process.argv && process.argv[1] && process.argv[1].includes('migrate.js'))) {
  initializeDatabase().catch((error) => {
    // This catch should never be reached since we don't throw in initializeDatabase anymore
    // But keeping it as a safety net
    console.error('⚠️  Database initialization error (this is OK if PostgreSQL is not set up yet):', error.message);
  });
}

// Export database helpers
module.exports = {
  pool,
  query,
  get,
  all,
  run,
  exec
};
