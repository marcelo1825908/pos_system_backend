const Printer = require('../models/Printer');
const PrinterService = require('../services/PrinterService');
const Order = require('../models/Order');

const PrinterController = {
  getAllPrinters: (req, res) => {
    try {
      const printers = Printer.getAll();
      res.json({ data: printers });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getPrinterById: (req, res) => {
    try {
      const id = req.params.id;
      const printer = Printer.getById(id);
      if (!printer) {
        return res.status(404).json({ error: 'Printer not found' });
      }
      res.json({ data: printer });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getMainPrinter: (req, res) => {
    try {
      const printer = Printer.getMainPrinter();
      if (!printer) {
        return res.status(404).json({ error: 'No main printer configured' });
      }
      res.json({ data: printer });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createPrinter: (req, res) => {
    try {
      const payload = req.body;
      
      // Validate connection string format
      const validationError = validateConnectionString(payload.connection_string);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
      
      const printer = Printer.create(payload);
      res.json({ data: printer });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updatePrinter: (req, res) => {
    try {
      const id = req.params.id;
      const payload = req.body;
      
      // Validate connection string format
      const validationError = validateConnectionString(payload.connection_string);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const printer = Printer.update(id, payload);
      if (!printer) {
        return res.status(404).json({ error: 'Printer not found' });
      }
      res.json({ data: printer });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deletePrinter: (req, res) => {
    try {
      const id = req.params.id;
      const success = Printer.delete(id);
      if (!success) {
        return res.status(404).json({ error: 'Printer not found' });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

 
  // Test printer connection
  testPrinter: async (req, res) => {
    try {
      const id = req.params.id;      
      const result = await PrinterService.testPrinter(id);      
      if (result.success) {
        res.json({ success: true, message: 'Test print successful' });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Test printer error:', error);
      res.status(500).json({ success: false, error: 'Failed to test printer' });
    }
  },

  // Print receipt
  printReceipt: async (req, res) => {
    try {
      let { printer_id, order_data, printerId, orderId } = req.body;

      // Frontend sends { printerId, orderId } -> fallback mapping
      if ((!printer_id || !order_data) && printerId && orderId) {
        printer_id = printerId;
        const order = Order.getById(orderId);
        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }
        order_data = order;
      }

      if (!printer_id || !order_data) {
        return res.status(400).json({ error: 'Printer ID and order data are required' });
      }

      const result = await PrinterService.printReceipt(printer_id, order_data);

      if (result.success) {
        res.json({ success: true, message: 'Receipt printed successfully' });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Print receipt error:', error);
      res.status(500).json({ success: false, error: 'Failed to print receipt' });
    }
  },

  // Print kitchen order
  printKitchenOrder: async (req, res) => {
    try {
      const { printer_id, order_data } = req.body;
      
      if (!printer_id || !order_data) {
        return res.status(400).json({ error: 'Printer ID and order data are required' });
      }
      
      const result = await PrinterService.printKitchenOrder(printer_id, order_data);
      
      if (result.success) {
        res.json({ success: true, message: 'Kitchen order printed successfully' });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Print kitchen order error:', error);
      res.status(500).json({ success: false, error: 'Failed to print kitchen order' });
    }
  },

  // Print kitchen order to multiple printers (batch)
  printKitchenOrderBatch: async (req, res) => {
    try {
      let { printerIds, printerId, orderId, orderData } = req.body;

      // Allow single printerId from frontend
      if ((!printerIds || !Array.isArray(printerIds) || printerIds.length === 0) && printerId) {
        printerIds = [printerId];
      }

      if (!printerIds || !Array.isArray(printerIds) || printerIds.length === 0) {
        return res.status(400).json({ error: 'Printer IDs array is required' });
      }

      // Get order data (from ID or directly)
      let order = orderData;
      if (!order) {
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID is required' });
        }

        // Get order data with items/details from database
        order = Order.getById(orderId);
        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }
      }

      console.log(`📦 Batch printing to ${printerIds.length} printer(s) for order #${order.id || orderId}`);

      // Print to all printers
      const results = await Promise.allSettled(
        printerIds.map(id => PrinterService.printKitchenOrder(id, order))
      );

      // Count successes and failures
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = results.length - successCount;

      // Collect error messages
      const errors = results
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
        .map(r => {
          if (r.status === 'rejected') {
            return r.reason ? r.reason.message : 'Unknown error';
          }
          const printerResult = r.value;
          const errorMsg = printerResult && printerResult.message ? printerResult.message : 'Unknown error';
          return errorMsg;
        });

      if (successCount > 0) {
        res.json({ 
          message: `Successfully printed to ${successCount} printer(s)`,
          success: true,
          successCount,
          failedCount,
          errors: errors.length > 0 ? errors : undefined
        });
      } else {
        res.status(400).json({ 
          error: 'Failed to print to all printers',
          success: false,
          successCount: 0,
          failedCount,
          errors
        });
      }
    } catch (err) {
      console.error('Batch print error:', err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  },

  // Print custom text
  printCustom: async (req, res) => {
    try {
      const { printer_id, text_lines } = req.body;
      
      if (!printer_id || !text_lines) {
        return res.status(400).json({ error: 'Printer ID and text lines are required' });
      }
      
      const result = await PrinterService.printCustom(printer_id, text_lines);
      
      if (result.success) {
        res.json({ success: true, message: 'Custom text printed successfully' });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Print custom text error:', error);
      res.status(500).json({ success: false, error: 'Failed to print custom text' });
    }
  },

  // Open cash drawer
  openDrawer: async (req, res) => {
    try {
      const { printer_id } = req.body;
      
      // printer_id is optional - will use main printer if not provided
      const result = await PrinterService.openDrawer(printer_id);
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.message });
      }
    } catch (error) {
      console.error('Open drawer error:', error);
      res.status(500).json({ success: false, error: 'Failed to open cash drawer' });
    }
  }
};

/**
 * Validate connection string format
 */
function validateConnectionString(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    return 'Connection string must be a non-empty string';
  }

  const trimmed = connectionString.trim();
  
  // Check for valid formats
  const validFormats = [
    /^tcp:\/\/[\d\.]+:\d+$/,           // TCP format: tcp://192.168.1.100:9100
    /^\\\\\.\\COM\d+$/i,               // Windows COM port: \\.\COM3
    /^\/dev\/(usb|lp)\//i,             // Linux device files: /dev/usb/lp0
    /^COM\d+$/i                        // Simple COM port: COM3
  ];
  
  const isValid = validFormats.some(format => format.test(trimmed));
  
  if (!isValid) {
    return 'Invalid connection string format. Valid formats: tcp://IP:PORT, \\\\.\\COM3, /dev/usb/lp0';
  }
  
  return null; // No error
}

module.exports = PrinterController;
