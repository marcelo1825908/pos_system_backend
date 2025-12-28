const db = require('../config/database');

class Printer {
  static async getAll() {
    const sql = 'SELECT * FROM printers ORDER BY is_main DESC, id ASC';
    return await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM printers WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async getMainPrinter() {
    const sql = 'SELECT * FROM printers WHERE is_main = 1 LIMIT 1';
    return await db.get(sql);
  }

  static async create(printer) {
    // Validate and normalize connection string
    const normalizedPrinter = this.normalizeConnectionString({...printer});
    
    // If this printer is being set as main, unset all other main printers
    if (normalizedPrinter.is_main) {
      await db.run('UPDATE printers SET is_main = 0');
    }
    
    const sql = `INSERT INTO printers (name, type, connection_string, is_main) VALUES ($1, $2, $3, $4) RETURNING id`;
    const params = [
      normalizedPrinter.name,
      normalizedPrinter.type,
      normalizedPrinter.connection_string || null,
      normalizedPrinter.is_main ? 1 : 0
    ];
    const result = await db.run(sql, params);
    return { id: result.lastInsertRowid, ...normalizedPrinter };
  }

  static async update(id, printer) {
    // Validate and normalize connection string
    const normalizedPrinter = this.normalizeConnectionString({...printer});
    
    // If this printer is being set as main, unset all other main printers
    if (normalizedPrinter.is_main) {
      await db.run('UPDATE printers SET is_main = 0 WHERE id != $1', [id]);
    }
    
    const sql = `UPDATE printers SET name = $1, type = $2, connection_string = $3, is_main = $4 WHERE id = $5`;
    const params = [
      normalizedPrinter.name,
      normalizedPrinter.type,
      normalizedPrinter.connection_string || null,
      normalizedPrinter.is_main ? 1 : 0,
      id
    ];
    await db.run(sql, params);
    return { id, ...normalizedPrinter };
  }

  static async delete(id) {
    const sql = 'DELETE FROM printers WHERE id = $1';
    return await db.run(sql, [id]);
  }

  /**
   * Normalize connection string format for different printer types
   */
  static normalizeConnectionString(printer) {
    if (!printer.connection_string) {
      return printer;
    }

    let connectionString = printer.connection_string.trim();
    
    // Handle different connection string formats
    if (connectionString.toLowerCase().startsWith('com')) {
      // Windows COM port (e.g., COM3 -> \\.\COM3)
      // Extract the COM port number and format properly
      const comMatch = connectionString.match(/COM(\d+)/i);
      if (comMatch) {
        connectionString = `\\\\.\\COM${comMatch[1]}`;
      } else if (!connectionString.startsWith('\\\\.\\')) {
        connectionString = `\\\\.\\${connectionString.toUpperCase()}`;
      }
    } else if (connectionString.match(/^\/dev\/|^\/usb\//)) {
      // Unix device files - already in correct format
    } else if (connectionString.includes(':') && !connectionString.includes('://')) {
      // IP:Port format without protocol (e.g., 192.168.1.100:9100 -> tcp://192.168.1.100:9100)
      connectionString = `tcp://${connectionString}`;
    } else if (!connectionString.includes('://') && !connectionString.startsWith('\\\\.\\') && !connectionString.startsWith('/')) {
      // If no protocol specified and doesn't look like a device file, assume TCP
      if (connectionString.includes('.')) {
        connectionString = `tcp://${connectionString}`;
      }
    }
    
    return {
      ...printer,
      connection_string: connectionString
    };
  }
}

module.exports = Printer;
