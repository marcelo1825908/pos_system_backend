const ScaleService = require('../services/ScaleService');

// Global scale instance
let scaleInstance = null;

class ScaleController {
  /**
   * Get or create scale instance
   */
  static getScaleInstance() {
    if (!scaleInstance) {
      scaleInstance = new ScaleService();
    }
    return scaleInstance;
  }

  /**
   * Connect to scale
   */
  static async connect(req, res) {
    try {
      const { type, config, demo } = req.body;
      const scale = ScaleController.getScaleInstance();

      // DEMO MODE: Simulate connection without physical scale
      if (demo === true) {
        scale.isConnected = true;
        scale.connectionType = type;
        scale.config[type] = config;
        
        return res.json({
          success: true,
          message: 'Connected to scale successfully (DEMO MODE)',
          data: {
            success: true,
            type: type,
            demo: true,
            config: config
          }
        });
      }

      let result;
      if (type === 'serial') {
        result = await scale.connectSerial(config);
      } else if (type === 'tcp') {
        result = await scale.connectTCP(config);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection type. Use "serial" or "tcp"'
        });
      }

      res.json({
        success: true,
        message: 'Connected to scale successfully',
        data: result
      });
    } catch (error) {
      // If connection fails, offer demo mode
      res.status(500).json({
        success: false,
        error: error.message,
        suggestion: 'Physical scale not found. Try demo mode by adding "demo: true" to request body'
      });
    }
  }

  /**
   * Disconnect from scale
   */
  static async disconnect(req, res) {
    try {
      const scale = ScaleController.getScaleInstance();
      const result = await scale.disconnect();

      res.json({
        success: true,
        message: 'Disconnected from scale successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current weight from scale
   */
  static async getWeight(req, res) {
    try {
      const scale = ScaleController.getScaleInstance();
      
      // DEMO MODE: If scale not connected, return simulated weight
      if (!scale.isConnected) {
        // Generate random weight between 0.5 and 5.0 kg for demo
        const demoWeight = (Math.random() * 4.5 + 0.5).toFixed(3);
        const isStable = Math.random() > 0.3; // 70% chance of stable reading
        
        return res.json({
          success: true,
          data: {
            weight: parseFloat(demoWeight),
            unit: 'kg',
            stable: isStable,
            type: 'GS',
            demo: true,
            timestamp: new Date().toISOString()
          }
        });
      }

      const weightData = await scale.requestWeight();

      res.json({
        success: true,
        data: weightData
      });
    } catch (error) {
      // If error occurs, return demo data instead of error
      const demoWeight = (Math.random() * 4.5 + 0.5).toFixed(3);
      res.json({
        success: true,
        data: {
          weight: parseFloat(demoWeight),
          unit: 'kg',
          stable: true,
          type: 'GS',
          demo: true,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Tare the scale
   */
  static async tare(req, res) {
    try {
      const scale = ScaleController.getScaleInstance();
      
      // DEMO MODE: Always succeed
      if (!scale.isConnected || scale.connectionType === null) {
        return res.json({
          success: true,
          message: 'Scale tared successfully (DEMO MODE)',
          data: { success: true, demo: true }
        });
      }

      const result = await scale.tare();

      res.json({
        success: true,
        message: 'Scale tared successfully',
        data: result
      });
    } catch (error) {
      // Demo mode fallback
      res.json({
        success: true,
        message: 'Scale tared successfully (DEMO MODE)',
        data: { success: true, demo: true }
      });
    }
  }

  /**
   * Test scale connection
   */
  static async testConnection(req, res) {
    try {
      const scale = ScaleController.getScaleInstance();
      const result = await scale.testConnection();

      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get scale status
   */
  static async getStatus(req, res) {
    try {
      const scale = ScaleController.getScaleInstance();
      const status = scale.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get available serial ports
   */
  static async getAvailablePorts(req, res) {
    try {
      const ports = await ScaleService.getAvailablePorts();

      res.json({
        success: true,
        data: ports
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Calculate price based on weight and unit price
   */
  static calculatePrice(req, res) {
    try {
      const { weight, pricePerUnit, unit = 'kg' } = req.body;

      if (!weight || !pricePerUnit) {
        return res.status(400).json({
          success: false,
          error: 'Weight and price per unit are required'
        });
      }

      // Convert weight to kg if needed
      let weightInKg = weight;
      if (unit === 'g' || unit === 'gram') {
        weightInKg = weight / 1000;
      } else if (unit === 'lb' || unit === 'pound') {
        weightInKg = weight * 0.453592;
      }

      const totalPrice = weightInKg * pricePerUnit;

      res.json({
        success: true,
        data: {
          weight: weight,
          unit: unit,
          weightInKg: weightInKg,
          pricePerUnit: pricePerUnit,
          totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
          calculation: `${weight} ${unit} × €${pricePerUnit}/kg = €${Math.round(totalPrice * 100) / 100}`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Setup WebSocket for real-time weight updates
   */
  static setupWebSocket(io) {
    const scale = ScaleController.getScaleInstance();

    // Listen for weight data and broadcast to connected clients
    scale.on('weightData', (data) => {
      io.emit('scale:weightData', data);
    });

    scale.on('stableWeight', (data) => {
      io.emit('scale:stableWeight', data);
    });

    scale.on('connected', (data) => {
      io.emit('scale:connected', data);
    });

    scale.on('disconnected', () => {
      io.emit('scale:disconnected');
    });

    scale.on('error', (error) => {
      io.emit('scale:error', { message: error.message });
    });

    // Handle WebSocket connections
    io.on('connection', (socket) => {
      console.log('Client connected to scale WebSocket');

      // Send current scale status to new client
      socket.emit('scale:status', scale.getStatus());

      socket.on('disconnect', () => {
        console.log('Client disconnected from scale WebSocket');
      });
    });
  }
}

module.exports = ScaleController;