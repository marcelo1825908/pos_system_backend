const Terminal = require('../models/Terminal');
const Order = require('../models/Order');
const db = require('../config/database');

class TerminalController {
  // Get all terminals
  static async getAllTerminals(req, res) {
    try {
      const terminals = await Terminal.getAll();
      res.json(terminals);
    } catch (error) {
      console.error('Error fetching terminals:', error);
      res.status(500).json({ error: 'Failed to fetch terminals' });
    }
  }

  // Get terminal by ID
  static async getTerminalById(req, res) {
    try {
      const terminal = await Terminal.getById(req.params.id);
      if (!terminal) {
        return res.status(404).json({ error: 'Terminal not found' });
      }
      res.json(terminal);
    } catch (error) {
      console.error('Error fetching terminal:', error);
      res.status(500).json({ error: 'Failed to fetch terminal' });
    }
  }

  // Get terminal by device_id
  static async getTerminalByDeviceId(req, res) {
    try {
      const terminal = await Terminal.getByDeviceId(req.params.deviceId);
      if (!terminal) {
        return res.status(404).json({ error: 'Terminal not found' });
      }
      // Don't send password in response
      const { password, ...terminalWithoutPassword } = terminal;
      res.json(terminalWithoutPassword);
    } catch (error) {
      console.error('Error fetching terminal:', error);
      res.status(500).json({ error: 'Failed to fetch terminal' });
    }
  }

  // Verify device login (device_id + password)
  static async verifyDeviceLogin(req, res) {
    try {
      const { device_id, password } = req.body;
      
      if (!device_id || !password) {
        return res.status(400).json({ error: 'device_id and password are required' });
      }

      // First check if device exists
      const terminal = await Terminal.getByDeviceId(device_id);
      if (!terminal) {
        return res.status(404).json({ error: 'Device not found', code: 'DEVICE_NOT_FOUND' });
      }

      // Check if device is pending
      if (terminal.status === 'pending') {
        return res.status(403).json({ error: 'Device is pending approval. Please wait for admin approval.', code: 'DEVICE_PENDING' });
      }

      // Verify password
      const verifiedTerminal = await Terminal.verifyPassword(device_id, password);
      if (!verifiedTerminal) {
        return res.status(401).json({ error: 'Invalid device ID or password', code: 'INVALID_CREDENTIALS' });
      }

      // Check if device is active
      if (verifiedTerminal.status !== 'active') {
        return res.status(403).json({ error: 'Device is not active. Please contact administrator.', code: 'DEVICE_INACTIVE' });
      }

      // Update last_seen
      await Terminal.updateLastSeen(device_id);

      // Don't send password in response
      const { password: _, ...terminalWithoutPassword } = verifiedTerminal;
      res.json(terminalWithoutPassword);
    } catch (error) {
      console.error('Error verifying device login:', error);
      res.status(500).json({ error: 'Failed to verify device login' });
    }
  }

  // Create new terminal
  static async createTerminal(req, res) {
    try {
      const { device_id, name, location, password } = req.body;

      if (!device_id || !name) {
        return res.status(400).json({ error: 'device_id and name are required' });
      }

      // Check if device_id already exists
      const existing = await Terminal.getByDeviceId(device_id);
      if (existing) {
        return res.status(400).json({ error: 'Device ID already registered' });
      }

      const terminal = await Terminal.create(device_id, name, location, password || '');
      // Don't send password in response
      const { password: _, ...terminalWithoutPassword } = terminal;
      res.status(201).json(terminalWithoutPassword);
    } catch (error) {
      console.error('Error creating terminal:', error);
      res.status(500).json({ error: 'Failed to create terminal' });
    }
  }

  // Update terminal
  static async updateTerminal(req, res) {
    try {
      const { name, location, status, password } = req.body;
      // Only update password if it's provided and not empty
      const passwordToUpdate = (password && password.trim() !== '') ? password : null;
      const terminal = await Terminal.update(req.params.id, name, location, status, passwordToUpdate);
      if (!terminal) {
        return res.status(404).json({ error: 'Terminal not found' });
      }
      // Don't send password in response
      const { password: _, ...terminalWithoutPassword } = terminal;
      res.json(terminalWithoutPassword);
    } catch (error) {
      console.error('Error updating terminal:', error);
      res.status(500).json({ error: 'Failed to update terminal' });
    }
  }

  // Delete terminal
  static async deleteTerminal(req, res) {
    try {
      await Terminal.delete(req.params.id);
      res.json({ message: 'Terminal deleted successfully' });
    } catch (error) {
      console.error('Error deleting terminal:', error);
      res.status(500).json({ error: 'Failed to delete terminal' });
    }
  }

  // Register device (for Electron app)
  static async registerDevice(req, res) {
    try {
      const { device_id, name, location, password } = req.body;

      if (!device_id || !name) {
        return res.status(400).json({ error: 'device_id and name are required' });
      }

      // Check if device already exists
      const existingTerminal = await Terminal.getByDeviceId(device_id);
      
      if (existingTerminal) {
        // Device ID already exists, return error
        return res.status(400).json({ error: 'Device ID already registered. Please use a different Device ID.' });
      }

      // Create new terminal
      const terminal = await Terminal.create(device_id, name, location, password || '');
      // Don't send password in response
      const { password: _, ...terminalWithoutPassword } = terminal;
      return res.status(201).json({ terminal: terminalWithoutPassword, isNew: true });
    } catch (error) {
      console.error('Error registering device:', error);
      // Check if it's a unique constraint error
      if (error.code === '23505' || (error.message && error.message.includes('UNIQUE constraint'))) {
        return res.status(400).json({ error: 'Device ID already registered. Please use a different Device ID.' });
      }
      res.status(500).json({ error: 'Failed to register device' });
    }
  }

  // Update last seen (heartbeat)
  static async updateLastSeen(req, res) {
    try {
      const { device_id } = req.body;
      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      await Terminal.updateLastSeen(device_id);
      res.json({ message: 'Last seen updated' });
    } catch (error) {
      console.error('Error updating last seen:', error);
      res.status(500).json({ error: 'Failed to update last seen' });
    }
  }

  // Get terminal statistics
  static async getTerminalStats(req, res) {
    try {
      const terminalId = req.params.id;
      const terminal = await Terminal.getById(terminalId);
      
      if (!terminal) {
        return res.status(404).json({ error: 'Terminal not found' });
      }

      // Get today's transactions
      const todayTransactionsResult = await db.get(`
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE device_id = $1 
        AND DATE(created_at) = CURRENT_DATE
      `, [terminal.device_id]);
      const todayTransactions = parseInt(todayTransactionsResult?.count) || 0;

      // Get today's sales
      const todaySalesResult = await db.get(`
        SELECT COALESCE(SUM(gross_total), 0) as total 
        FROM orders 
        WHERE device_id = $1 
        AND DATE(created_at) = CURRENT_DATE
        AND status = $2
      `, [terminal.device_id, 'completed']);
      const todaySales = parseFloat(todaySalesResult?.total) || 0;

      // Get this month's sales
      const monthSalesResult = await db.get(`
        SELECT COALESCE(SUM(gross_total), 0) as total 
        FROM orders 
        WHERE device_id = $1 
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = $2
      `, [terminal.device_id, 'completed']);
      const monthSales = parseFloat(monthSalesResult?.total) || 0;

      res.json({
        terminal,
        stats: {
          todayTransactions,
          todaySales,
          monthSales
        }
      });
    } catch (error) {
      console.error('Error fetching terminal stats:', error);
      res.status(500).json({ error: 'Failed to fetch terminal stats' });
    }
  }

  // Get dashboard statistics (for admin)
  static async getDashboardStats(req, res) {
    try {
      const totalTerminals = await Terminal.getActiveCount();
      const onlineTerminals = await Terminal.getOnlineCount();

      const db = require('../config/database');

      // Get total sales
      let totalSales = 0;
      try {
        const result = await db.get(`
          SELECT COALESCE(SUM(gross_total), 0) as total 
          FROM orders 
          WHERE status = $1
        `, ['completed']);
        totalSales = parseFloat(result?.total) || 0;
      } catch (err) {
        console.error('Error getting total sales:', err);
      }

      // Get this month's sales
      let monthSales = 0;
      try {
        const result = await db.get(`
          SELECT COALESCE(SUM(gross_total), 0) as total 
          FROM orders 
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          AND status = $1
        `, ['completed']);
        monthSales = parseFloat(result?.total) || 0;
      } catch (err) {
        console.error('Error getting month sales:', err);
      }

      // Get today's sales
      let todaySales = 0;
      try {
        const result = await db.get(`
          SELECT COALESCE(SUM(gross_total), 0) as total 
          FROM orders 
          WHERE DATE(created_at) = CURRENT_DATE
          AND status = $1
        `, ['completed']);
        todaySales = parseFloat(result?.total) || 0;
      } catch (err) {
        console.error('Error getting today sales:', err);
      }

      // Get total items sold
      let totalItemsSold = 0;
      try {
        const result = await db.get(`
          SELECT COALESCE(SUM(qty), 0) as total 
          FROM order_details
          JOIN orders ON order_details.order_id = orders.id
          WHERE orders.status = $1
        `, ['completed']);
        totalItemsSold = parseFloat(result?.total) || 0;
      } catch (err) {
        console.error('Error getting total items sold:', err);
      }

      // Get today's items sold
      let todayItemsSold = 0;
      try {
        const result = await db.get(`
          SELECT COALESCE(SUM(qty), 0) as total 
          FROM order_details
          JOIN orders ON order_details.order_id = orders.id
          WHERE orders.status = $1
          AND DATE(orders.created_at) = CURRENT_DATE
        `, ['completed']);
        todayItemsSold = parseFloat(result?.total) || 0;
      } catch (err) {
        console.error('Error getting today items sold:', err);
      }

      // Get weekly sales data (last 7 days)
      let weeklySales = [];
      try {
        weeklySales = await db.all(`
          SELECT 
            EXTRACT(DOW FROM created_at)::INTEGER as day,
            COALESCE(SUM(gross_total), 0) as total
          FROM orders
          WHERE created_at >= NOW() - INTERVAL '7 days'
          AND status = $1
          GROUP BY EXTRACT(DOW FROM created_at)
          ORDER BY day
        `, ['completed']);
        // Convert day numbers to match PostgreSQL format (0-6)
        weeklySales = weeklySales.map(item => ({
          day: item.day.toString(),
          total: parseFloat(item.total)
        }));
      } catch (err) {
        console.error('Error getting weekly sales:', err);
      }

      // Get monthly sales data (last 12 months)
      let monthlySales = [];
      try {
        monthlySales = await db.all(`
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            TO_CHAR(created_at, 'MM') as month_num,
            COALESCE(SUM(gross_total), 0) as total
          FROM orders
          WHERE created_at >= NOW() - INTERVAL '12 months'
          AND status = $1
          GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'MM')
          ORDER BY month
        `, ['completed']);
        monthlySales = monthlySales.map(item => ({
          month: item.month,
          month_num: item.month_num,
          total: parseFloat(item.total)
        }));
      } catch (err) {
        console.error('Error getting monthly sales:', err);
      }

      // Get yearly sales data (last 5 years)
      let yearlySales = [];
      try {
        yearlySales = await db.all(`
          SELECT 
            TO_CHAR(created_at, 'YYYY') as year,
            COALESCE(SUM(gross_total), 0) as total
          FROM orders
          WHERE created_at >= NOW() - INTERVAL '5 years'
          AND status = $1
          GROUP BY TO_CHAR(created_at, 'YYYY')
          ORDER BY year
        `, ['completed']);
        yearlySales = yearlySales.map(item => ({
          year: item.year,
          total: parseFloat(item.total)
        }));
      } catch (err) {
        console.error('Error getting yearly sales:', err);
      }

      // Get register transactions today
      let todayTransactions = 0;
      try {
        const result = await db.get(`
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE DATE(created_at) = CURRENT_DATE
          AND status = $1
        `, ['completed']);
        todayTransactions = parseInt(result?.count) || 0;
      } catch (err) {
        console.error('Error getting today transactions:', err);
      }

      // Get card payment percentage
      // Note: payment_method is not stored in orders table, so we'll default to 0
      // This can be enhanced later if payment method tracking is added to orders
      const cardPaymentPercentage = 0;

      res.json({
        totalTerminals,
        onlineTerminals,
        totalSales,
        monthSales,
        todaySales,
        totalItemsSold,
        todayItemsSold,
        weeklySales,
        monthlySales,
        yearlySales,
        todayTransactions,
        cardPaymentPercentage
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
    }
  }
}

module.exports = TerminalController;

