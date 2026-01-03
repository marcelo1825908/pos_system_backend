// Load environment variables from .env file
// Look for .env in project root (one level up from server)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (error) => {
  // Only log database connection errors, don't crash
  if (error.code === '28P01' || error.code === 'ECONNREFUSED' || error.code === '42P01') {
    console.error('⚠️  Unhandled database connection error (this is OK if PostgreSQL is not set up yet):', error.message);
  } else {
    console.error('⚠️  Unhandled promise rejection:', error.message);
  }
  // Don't exit - allow server to continue
});

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

// Load migrations
const { runMigrations } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: isDev ? "http://localhost:3000" : false,
    methods: ["GET", "POST"]
  }
});

// Run migrations before starting the server
(async () => {
  try {
    await runMigrations();
  } catch (error) {
    console.error('Failed to run migrations:', error);
    // Don't exit - allow server to start even if migrations fail
    // (useful if PostgreSQL is not yet configured)
  }
})();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const apiRoutes = require('./routes/api');
const mosqueRoutes = require('./routes/mosque');
const ScaleController = require('./controllers/ScaleController');

// Mount API routes
app.use('/api', apiRoutes);
app.use('/api/mosque', mosqueRoutes);

// Setup WebSocket for scale integration
ScaleController.setupWebSocket(io);

// Serve React app in production
if (!isDev) {
  // Determine the correct path to the client build
  let clientBuildPath;

  // Try multiple possible locations
  const possiblePaths = [
    // Packaged app locations
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'packages', 'client', 'build') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', 'packages', 'client', 'build') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app', 'packages', 'client', 'build') : null,
    // Unpacked app locations
    path.join(__dirname, '../client/build'),
    path.join(process.cwd(), 'packages', 'client', 'build'),
    path.join(process.cwd(), 'client', 'build'),
  ].filter(p => p !== null);

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath) && fs.existsSync(path.join(possiblePath, 'index.html'))) {
      clientBuildPath = possiblePath;
      console.log('✅ Found client build at:', clientBuildPath);
      break;
    }
  }

  if (!clientBuildPath) {
    console.error('❌ Could not find client build directory. Tried:');
    possiblePaths.forEach(p => console.error('   -', p));
    console.error('⚠️  Server will start but client may not load correctly');
  } else {
    app.use(express.static(clientBuildPath));

    // Handle React routing - send all non-API requests to index.html
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(clientBuildPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Client build not found');
        }
      }
    });
  }
}

// Test routes
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from Node.js Backend! 🎉',
    timestamp: new Date().toISOString(),
    status: 'Server is running successfully'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📁 __dirname: ${__dirname}`);
  if (process.resourcesPath) {
    console.log(`📁 Resources path: ${process.resourcesPath}`);
  }
}).on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`   Port ${PORT} is already in use`);
  }
  process.exit(1);
});
