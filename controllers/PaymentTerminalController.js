const PaymentTerminal = require('../models/PaymentTerminal');
const PaymentService = require('../services/PaymentService');

const PaymentTerminalController = {
  getAllTerminals: async (req, res) => {
    try {
      const terminals = await PaymentTerminal.getAll();
      res.json({ data: terminals });
    } catch (err) {
      console.error('Error getting all terminals:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getTerminalById: async (req, res) => {
    try {
      const id = req.params.id;
      const terminal = await PaymentTerminal.getById(id);
      if (!terminal) {
        return res.status(404).json({ error: 'Payment terminal not found' });
      }
      res.json({ data: terminal });
    } catch (err) {
      console.error('Error getting terminal by ID:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createTerminal: async (req, res) => {
    try {
      const payload = req.body;
      
      // Validate connection string format
      const validationError = validateConnectionString(payload.connection_string, payload.connection_type);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
      
      const terminal = await PaymentTerminal.create(payload);
      res.json({ data: terminal });
    } catch (err) {
      console.error('Error creating payment terminal:', err);
      
      // Check for unique constraint violation
      if (err.message && (err.message.includes('UNIQUE constraint') || err.message.includes('duplicate key'))) {
        return res.status(400).json({ error: 'A terminal with this configuration already exists' });
      }
      
      res.status(500).json({ error: 'Failed to create payment terminal: ' + (err.message || 'Internal server error') });
    }
  },

  updateTerminal: async (req, res) => {
    try {
      const id = req.params.id;
      const payload = req.body;
      
      // Validate connection string format
      const validationError = validateConnectionString(payload.connection_string, payload.connection_type);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const terminal = await PaymentTerminal.update(id, payload);
      if (!terminal) {
        return res.status(404).json({ error: 'Payment terminal not found' });
      }
      res.json({ data: terminal });
    } catch (err) {
      console.error('Error updating payment terminal:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteTerminal: async (req, res) => {
    try {
      const id = req.params.id;
      const success = await PaymentTerminal.delete(id);
      if (!success) {
        return res.status(404).json({ error: 'Payment terminal not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting payment terminal:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Test terminal connection
  testTerminal: async (req, res) => {
    try {
      const id = req.params.id;
      const terminal = await PaymentTerminal.getById(id);
      
      if (!terminal) {
        return res.status(404).json({ error: 'Payment terminal not found' });
      }
      
      console.log(`🧪 Testing ${terminal.type} terminal: ${terminal.name}`);
      
      const result = await PaymentService.testTerminalConnection(terminal);
      
      if (result.success) {
        res.json({ success: true, message: 'Terminal connection successful' });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Test terminal error:', error);
      res.status(500).json({ success: false, error: 'Failed to test terminal' });
    }
  }
};

/**
 * Validate connection string format
 */
function validateConnectionString(connectionString, connectionType) {
  if (!connectionString || typeof connectionString !== 'string') {
    return 'Connection string must be a non-empty string';
  }

  const trimmed = connectionString.trim();
  
  // For JSON format (used by Cashmatic and Payworld), just check it's valid JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return null; // Valid JSON object
    }
  } catch (e) {
    // Not JSON, check other formats
  }
  
  if (connectionType === 'tcp') {
    // TCP format: tcp://192.168.1.100:9100 or 192.168.1.100:9100
    const tcpPattern = /^(tcp:\/\/)?[\d\.]+:\d+$/;
    if (!tcpPattern.test(trimmed)) {
      return 'Invalid TCP connection string. Format: tcp://IP:PORT or IP:PORT';
    }
  } else if (connectionType === 'serial') {
    // Serial format: COM3 or /dev/ttyUSB0
    const serialPattern = /^(COM\d+|\/dev\/(ttyUSB|ttyACM|ttyS)\d+)$/i;
    if (!serialPattern.test(trimmed)) {
      return 'Invalid serial connection string. Format: COM3 or /dev/ttyUSB0';
    }
  } else if (connectionType === 'api' || connectionType === 'network') {
    // API/Network format: http://... or https://...
    const apiPattern = /^https?:\/\/.+/;
    if (!apiPattern.test(trimmed)) {
      // If not URL, allow JSON format
      try {
        JSON.parse(trimmed);
        return null; // Valid JSON
      } catch (e) {
        return 'Invalid API/Network connection string. Format: http://... or https://... or valid JSON';
      }
    }
  }
  
  return null; // No error
}

module.exports = PaymentTerminalController;
