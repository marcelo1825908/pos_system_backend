const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const Printer = require('../models/Printer');
const PrTable = require('../models/PrTable');

class PrinterService {
  /**
   * Get printer type from string
   */
  static getPrinterType(typeString) {
    const types = {
      'EPSON': PrinterTypes.EPSON,
      'STAR': PrinterTypes.STAR,
      'TANCA': PrinterTypes.TANCA,
      'DARUMA': PrinterTypes.DARUMA,
      'BROTHER': PrinterTypes.BROTHER
    };
    return types[typeString] || PrinterTypes.EPSON;
  }

  /**
   * Normalize order data so that it always has an items[] array.
   * Accepts both { items: [...] } and { details: [...] } as used by Order.getById.
   */
  static normalizeOrderData(orderData) {
    if (!orderData) {
      return null;
    }

    // Clone to avoid mutating original object unexpectedly
    const normalized = { ...orderData };

    // If items already exists and is an array, keep it
    if (Array.isArray(normalized.items) && normalized.items.length > 0) {
      return normalized;
    }

    // If details exists (from Order.getById), map to items
    if (Array.isArray(orderData.details)) {
      normalized.items = orderData.details.map(d => ({
        name: d.product_name || d.name || '',
        qty: d.qty || d.quantity || 1,
        price: (typeof d.price === 'number' ? d.price : 0),
        notes: d.notes || d.note || ''
      }));
      return normalized;
    }

    // Fallback: no items, ensure at least empty array
    normalized.items = Array.isArray(normalized.items) ? normalized.items : [];
    return normalized;
  }

  /**
   * Create thermal printer instance
   */
  static createPrinterInstance(printerConfig) {
    // Handle different connection types
    let interfaceString = printerConfig.connection_string || 'tcp://localhost:9100';

    // Ensure proper formatting for different connection types
    if (interfaceString.startsWith('COM') || interfaceString.includes('COM')) {
      // Windows COM port format
      if (!interfaceString.startsWith('\\\\.\\')) {
        interfaceString = `\\\\.\\${interfaceString}`;
      }
    } else if (interfaceString.startsWith('/dev/') || interfaceString.startsWith('/usb/')) {
      // Unix-like device file format
      // Already in correct format
    } else if (!interfaceString.startsWith('tcp://') && interfaceString.includes(':')) {
      // Assume IP:Port format, convert to tcp://IP:Port
      interfaceString = `tcp://${interfaceString}`;
    } else if (!interfaceString.startsWith('tcp://') && !interfaceString.startsWith('\\\\.\\') && !interfaceString.startsWith('/')) {
      // Default to TCP if no protocol specified
      interfaceString = `tcp://${interfaceString}`;
    }

    // Map printer type string to PrinterTypes
    const type = this.getPrinterType(printerConfig.type);

    const printer = new ThermalPrinter({
      type: type,
      interface: interfaceString,
      options: {
        timeout: 5000
      },
      characterSet: 'SLOVENIA',
      removeSpecialCharacters: false,
      lineCharacter: '-'
    });

    return printer;
  }

  /**
   * Test printer connection and basic printing
   */
  static async testPrinter(printerId) {
    try {
      const printerConfig = Printer.getById(printerId);
      if (!printerConfig) {
        throw new Error('Printer not found in database');
      }

      // Clean connection string (same as in createPrinterInstance)
      const cleanConnection = printerConfig.connection_string ? printerConfig.connection_string.trim() : '';

      if (!cleanConnection) {
        throw new Error('No connection string configured for this printer');
      }

      const printer = this.createPrinterInstance(printerConfig);

      // Connect to printer
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer is not connected or not reachable');
      }

      // Print test content
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println('*** TEST PRINT ***');
      printer.bold(false);
      printer.setTextNormal();
      printer.drawLine();
      printer.println(`Printer: ${printerConfig.name}`);
      printer.println(`Type: ${printerConfig.type}`);
      printer.println(`Interface: ${cleanConnection}`);
      printer.drawLine();
      printer.println('If you can read this, the printer is working.');
      printer.newLine();
      printer.println('Thank you for using POS Printer Service.');
      printer.newLine();
      printer.cut();

      await printer.execute();
      return { success: true };
    } catch (error) {
      console.error('Test print error:', error);

      // Map common errors to user-friendly messages
      let errorMessage = 'Unknown error during test print';

      if (error.message.includes('not reachable') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to printer. Check IP/Port or cable connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Printer connection timed out. Check if printer is turned on and reachable.';
      } else if (error.message.includes('Printer not found')) {
        errorMessage = 'Printer not found in the system. Please check printer configuration.';
      } else if (error.message.includes('No connection string')) {
        errorMessage = 'No connection string configured. Please set printer IP/Port or COM port.';
      } else {
        errorMessage = error.message;
      }

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Get printer configuration (main or by ID)
   * Shared function to avoid code duplication
   * @param {number} printerId - Optional printer ID
   * @returns {Object} Printer configuration with cleaned connection string
   */
  static getPrinterConfig(printerId = null) {
    let printerConfig;
    
    if (!printerId) {
      printerConfig = Printer.getMainPrinter();
      if (!printerConfig) {
        throw new Error('No printer ID provided and no main printer configured');
      }
      console.log(`Using main printer: ${printerConfig.name} (ID: ${printerConfig.id})`);
    } else {
      printerConfig = Printer.getById(printerId);
      if (!printerConfig) {
        throw new Error('Printer not found in database');
      }
    }

    // Clean connection string
    const cleanConnection = printerConfig.connection_string ? printerConfig.connection_string.trim() : '';
    if (!cleanConnection) {
      throw new Error('No connection string configured for this printer');
    }

    return {
      ...printerConfig,
      connection_string: cleanConnection
    };
  }

  /**
   * Send cash drawer open command to printer instance
   * (Internal helper - used within printReceipt)
   * @param {ThermalPrinter} printer - The thermal printer instance
   */
  static async sendDrawerCommand(printer) {
    if (!printer) {
      console.error('❌ No printer instance provided');
      return;
    }
    
    try {
      // ESC/POS command to open cash drawer
      // ESC p m t1 t2 (0x1B 0x70 0x00 0x32 0x32)
      const OPEN_DRAWER = Buffer.from([0x1B, 0x70, 0x00, 0x32, 0x32]);
      printer.raw(OPEN_DRAWER);
      console.log('✅ Cash drawer command added to print buffer');
    } catch (error) {
      console.error('❌ Failed to add drawer command:', error.message);
    }
  }

  /**
   * Open cash drawer using main printer (standalone function)
   * Can be called independently without printing a receipt
   * @param {number} printerId - Optional printer ID, uses main printer if not provided
   */
  static async openDrawer(printerId = null) {
    try {
      console.log('💰 Opening cash drawer...');
      
      // Get printer config using shared function
      const printerConfig = this.getPrinterConfig(printerId);

      // Create printer instance
      const printer = this.createPrinterInstance(printerConfig);

      // Check connection
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer is not connected or not reachable');
      }

      // Send drawer open command
      const OPEN_DRAWER = Buffer.from([0x1B, 0x70, 0x00, 0x32, 0x32]);
      printer.raw(OPEN_DRAWER);
      
      // Execute
      await printer.execute();
      
      console.log('✅ Cash drawer opened successfully');
      return { success: true, message: 'Cash drawer opened successfully' };
      
    } catch (error) {
      console.error('❌ Failed to open cash drawer:', error.message);
      
      let errorMessage = 'Unknown error while opening cash drawer';
      if (error.message.includes('not reachable') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to printer. Check IP/Port or cable connection.';
      } else if (error.message.includes('No main printer')) {
        errorMessage = 'No main printer configured. Please set a main printer in settings.';
      } else {
        errorMessage = error.message;
      }
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Print receipt
   */
  static async printReceipt(printerId, orderData) {
    try {
      // Ensure order data has items[] array
      orderData = PrinterService.normalizeOrderData(orderData);
      if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        throw new Error('Order has no items to print');
      }

      // Get printer config using shared function
      const printerConfig = this.getPrinterConfig(printerId);
      console.log(`📄 Printing receipt...`);

      const printer = this.createPrinterInstance(printerConfig);
      
      // Check if printer is connected
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer is not connected or not reachable');
      }
      
      // Get table info if available
      let tableInfo = null;
      if (orderData.table_id) {
        tableInfo = PrTable.getById(orderData.table_id);
      }

      // ============ RECEIPT TITLE ============
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println('RECEIPT');
      printer.bold(false);
      printer.setTextNormal();
      printer.drawLine();

      // ============ ORDER INFO ============
      printer.alignLeft();
      printer.bold(true);
      printer.println(`Transaction #: ${orderData.id}`);
      printer.bold(false);

      const orderDate = new Date(orderData.created_at);
      printer.println(`Date: ${orderDate.toLocaleDateString()}`);
      printer.println(`Time: ${orderDate.toLocaleTimeString()}`);

      // Print member name if available (for mosque payments)
      if (orderData.member_name) {
        printer.println(`Member: ${orderData.member_name}`);
      }

      // Print payment type if available (for mosque payments)
      if (orderData.payment_type) {
        printer.println(`Payment Type: ${orderData.payment_type}`);
      }

      // Print payment method if available (for mosque payments)
      if (orderData.payment_method) {
        printer.println(`Payment Method: ${orderData.payment_method}`);
      }

      if (tableInfo) {
        printer.println(`Table: ${tableInfo.table_no}${tableInfo.room_name ? ` (${tableInfo.room_name})` : ''}`);
      }

      printer.drawLine();

      // ============ ITEMS ============
      printer.bold(true);
      printer.println('Items');
      printer.bold(false);

      let subtotal = 0;
      for (const item of orderData.items) {
        const itemTotal = item.qty * item.price;
        subtotal += itemTotal;

        printer.println(`${item.qty} x ${item.name}`);
        printer.println(`   EUR ${itemTotal.toFixed(2)}`);

        // Print item notes if any
        if (item.notes) {
          printer.println(`   Note: ${item.notes}`);
        }
      }

      printer.drawLine();

      // ============ TOTALS ============
      const discount = orderData.discount || 0;
      const tax = orderData.tax || 0;
      const total = subtotal - discount + tax;

      printer.println(`Subtotal: EUR ${subtotal.toFixed(2)}`);
      if (discount > 0) {
        printer.println(`Discount: EUR ${discount.toFixed(2)}`);
      }
      if (tax > 0) {
        printer.println(`Tax: EUR ${tax.toFixed(2)}`);
      }
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(`TOTAL: EUR ${total.toFixed(2)}`);
      printer.setTextNormal();
      printer.bold(false);

      printer.newLine();

      // ============ FOOTER ============
      printer.alignCenter();
      printer.println('Thank you for your business!');
      printer.println('Please come again soon.');
      printer.newLine();
      printer.println('--- End of Receipt ---');
      printer.newLine();
      printer.cut();

      // Execute receipt printing first
      await printer.execute();
      console.log('✅ Receipt printed successfully');
      
      // Now open cash drawer AFTER receipt is printed
      console.log('💰 Opening cash drawer after receipt...');
      const drawerResult = await this.openDrawer(printerConfig.id);
      
      if (drawerResult.success) {
        console.log('✅ Cash drawer opened successfully');
      } else {
        console.warn('⚠️ Receipt printed but drawer failed:', drawerResult.message);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Receipt print error:', error);

      let errorMessage = 'Unknown error during receipt printing';

      if (error.message.includes('Printer not found')) {
        errorMessage = 'Printer not found in the system. Please check printer configuration.';
      } else if (error.message.includes('No connection string')) {
        errorMessage = 'No connection string configured. Please set printer IP/Port or COM port.';
      } else if (error.message.includes('no items')) {
        errorMessage = 'Order has no items to print.';
      } else {
        errorMessage = error.message;
      }

      return { success: false, message: errorMessage };
    }
  }

  /**
   * Print custom text (generic)
   */
  static async printCustom(printerId, textLines) {
    try {
      const printerConfig = Printer.getById(printerId);
      if (!printerConfig) {
        throw new Error('Printer not found in database');
      }

      const cleanConnection = printerConfig.connection_string ? printerConfig.connection_string.trim() : '';
      if (!cleanConnection) {
        throw new Error('No connection string configured for this printer');
      }

      const cleanConfig = {
        ...printerConfig,
        connection_string: cleanConnection
      };

      const printer = this.createPrinterInstance(cleanConfig);

      printer.alignLeft();
      if (Array.isArray(textLines)) {
        for (const line of textLines) {
          printer.println(line);
        }
      } else if (typeof textLines === 'string') {
        printer.println(textLines);
      } else {
        throw new Error('Invalid text_lines format. Must be string or string[]');
      }

      printer.newLine();
      printer.cut();

      await printer.execute();
      return { success: true };
    } catch (error) {
      console.error('Custom text print error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Print kitchen order
   */
  static async printKitchenOrder(printerId, orderData) {
    try {
      // Ensure order data has items[] array
      orderData = PrinterService.normalizeOrderData(orderData);
      if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        throw new Error('Order has no items to print');
      }

      // Get printer config using shared function
      const printerConfig = this.getPrinterConfig(printerId);
      console.log(`🍳 Printing kitchen order...`);

      const printer = this.createPrinterInstance(printerConfig);
      
      // Check if printer is connected
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error('Printer is not connected or not reachable');
      }

      // Get table info if available
      let tableInfo = null;
      if (orderData.table_id) {
        tableInfo = PrTable.getById(orderData.table_id);
      }

      // ============ HEADER ============
      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println('KITCHEN ORDER');
      printer.bold(false);
      printer.setTextNormal();
      printer.drawLine();

      // ============ ORDER INFO ============
      printer.alignLeft();
      const orderDate = new Date(orderData.created_at);
      printer.println(`Order #: ${orderData.id}`);
      printer.println(`Date: ${orderDate.toLocaleDateString()}`);
      printer.println(`Time: ${orderDate.toLocaleTimeString()}`);

      if (tableInfo) {
        printer.println(`Table: ${tableInfo.table_no}${tableInfo.room_name ? ` (${tableInfo.room_name})` : ''}`);
      }

      printer.drawLine();

      // ============ ITEMS ============
      printer.bold(true);
      printer.println('Items');
      printer.bold(false);

      for (const item of orderData.items) {
        printer.println(`${item.qty} x ${item.name}`);
        if (item.notes) {
          printer.println(`   Note: ${item.notes}`);
        }
      }

      printer.drawLine();

      // ============ FOOTER ============
      printer.alignCenter();
      printer.println('--- End of Kitchen Order ---');
      printer.newLine();
      printer.cut();

      await printer.execute();
      return { success: true };
    } catch (error) {
      console.error('Kitchen order print error:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = PrinterService;
