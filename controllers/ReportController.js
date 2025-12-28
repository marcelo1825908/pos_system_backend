const db = require('../config/database');

const ReportController = {
  /**
   * X Report - Non-resetting daily sales report
   * Shows current sales data without closing the register
   * Can be run multiple times during the day
   * 
   * FILTERING LOGIC:
   * - Uses order.updated_at field (automatically updated when order changes)
   * - Filters by DATE(updated_at) = selected date
   * - Only includes orders with status = 'completed' OR 'paid'
   * 
   * IMPORTANT: updated_at is automatically set when order status changes
   * - Order created yesterday but completed today will appear in TODAY's report
   * - This is better for daily cash reconciliation
   */
  getXReport: async (req, res) => {
    try {
      const { date } = req.query;
      const reportDate = date || new Date().toISOString().split('T')[0];
      
      // Use updated_at field which is automatically maintained by database trigger
      const dateField = 'updated_at';
      
      // Get all completed orders for the specified date
      const orders = await db.all(`
        SELECT * FROM orders 
        WHERE DATE(${dateField}) = $1 
        AND status IN ('completed', 'paid')
        ORDER BY ${dateField} DESC
      `, [reportDate]);

      // Calculate totals
      let totalSales = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let totalOrders = orders.length;
      let grossTotal = 0;

      orders.forEach(order => {
        totalSales += order.net_total || 0;
        totalTax += order.tax || 0;
        totalDiscount += order.discount || 0;
        grossTotal += order.gross_total || 0;
      });

      // Get payment method breakdown (from order details/notes if tracked)
      const paymentMethods = {
        cash: 0,
        card: 0,
        other: 0
      };

      // Get category-wise sales
      const categorySales = await db.all(`
        SELECT 
          c.name as category_name,
          COUNT(DISTINCT o.id) as order_count,
          SUM(od.qty) as total_quantity,
          SUM(od.total) as total_sales
        FROM orders o
        JOIN order_details od ON o.id = od.order_id
        JOIN products p ON od.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE DATE(o.${dateField}) = $1
        AND o.status IN ('completed', 'paid')
        GROUP BY c.id, c.name
        ORDER BY total_sales DESC
      `, [reportDate]);

      // Get top selling products
      const topProducts = await db.all(`
        SELECT 
          p.name as product_name,
          SUM(od.qty) as quantity_sold,
          SUM(od.total) as total_revenue
        FROM orders o
        JOIN order_details od ON o.id = od.order_id
        JOIN products p ON od.product_id = p.id
        WHERE DATE(o.${dateField}) = $1
        AND o.status IN ('completed', 'paid')
        GROUP BY p.id, p.name
        ORDER BY quantity_sold DESC
        LIMIT 10
      `, [reportDate]);

      // Get hourly sales breakdown
      const hourlySales = await db.all(`
        SELECT 
          TO_CHAR(${dateField}, 'HH24:00') as hour,
          COUNT(*) as order_count,
          SUM(net_total) as total_sales
        FROM orders
        WHERE DATE(${dateField}) = $1
        AND status IN ('completed', 'paid')
        GROUP BY TO_CHAR(${dateField}, 'HH24')
        ORDER BY hour
      `, [reportDate]);

      const report = {
        reportType: 'X',
        reportDate,
        generatedAt: new Date().toISOString(),
        summary: {
          totalOrders,
          grossTotal: grossTotal.toFixed(2),
          totalDiscount: totalDiscount.toFixed(2),
          totalTax: totalTax.toFixed(2),
          netTotal: totalSales.toFixed(2),
          averageOrderValue: totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0.00'
        },
        paymentMethods,
        categorySales,
        topProducts,
        hourlySales,
        orders: orders.map(o => ({
          id: o.id,
          order_no: o.order_no,
          created_at: o.created_at,
          updated_at: o.updated_at,
          gross_total: o.gross_total,
          discount: o.discount,
          tax: o.tax,
          net_total: o.net_total
        }))
      };

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('X Report error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate X Report' });
    }
  },

  /**
   * Z Report - End-of-day report
   * Shows final sales totals for the day
   * Should only be run once at end of business day
   * 
   * FILTERING LOGIC:
   * - Uses order.updated_at field (automatically updated when order changes)
   * - Filters by DATE(updated_at) = selected date
   * - Only includes orders with status = 'completed' OR 'paid'
   * 
   * NOTE: Z reports are generated on-demand from orders table
   * No separate storage needed - all data comes from orders
   */
  getZReport: async (req, res) => {
    try {
      const { date } = req.query;
      const reportDate = date || new Date().toISOString().split('T')[0];
      
      // Use updated_at field which is automatically maintained by database trigger
      const dateField = 'updated_at';

      // Get all completed orders for the specified date
      const orders = await db.all(`
        SELECT * FROM orders 
        WHERE DATE(${dateField}) = $1 
        AND status IN ('completed', 'paid')
        ORDER BY ${dateField} DESC
      `, [reportDate]);

      // Calculate totals
      let totalSales = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let totalOrders = orders.length;
      let grossTotal = 0;

      orders.forEach(order => {
        totalSales += order.net_total || 0;
        totalTax += order.tax || 0;
        totalDiscount += order.discount || 0;
        grossTotal += order.gross_total || 0;
      });

      // Get payment method breakdown
      const paymentMethods = {
        cash: 0,
        card: 0,
        other: 0
      };

      // Get category-wise sales
      const categorySales = await db.all(`
        SELECT 
          c.name as category_name,
          COUNT(DISTINCT o.id) as order_count,
          SUM(od.qty) as total_quantity,
          SUM(od.total) as total_sales
        FROM orders o
        JOIN order_details od ON o.id = od.order_id
        JOIN products p ON od.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE DATE(o.${dateField}) = $1
        AND o.status IN ('completed', 'paid')
        GROUP BY c.id, c.name
        ORDER BY total_sales DESC
      `, [reportDate]);

      // Get top selling products
      const topProducts = await db.all(`
        SELECT 
          p.name as product_name,
          SUM(od.qty) as quantity_sold,
          SUM(od.total) as total_revenue
        FROM orders o
        JOIN order_details od ON o.id = od.order_id
        JOIN products p ON od.product_id = p.id
        WHERE DATE(o.${dateField}) = $1
        AND o.status IN ('completed', 'paid')
        GROUP BY p.id, p.name
        ORDER BY quantity_sold DESC
        LIMIT 10
      `, [reportDate]);

      // Get hourly sales breakdown
      const hourlySales = await db.all(`
        SELECT 
          TO_CHAR(${dateField}, 'HH24:00') as hour,
          COUNT(*) as order_count,
          SUM(net_total) as total_sales
        FROM orders
        WHERE DATE(${dateField}) = $1
        AND status IN ('completed', 'paid')
        GROUP BY TO_CHAR(${dateField}, 'HH24')
        ORDER BY hour
      `, [reportDate]);

      const report = {
        reportType: 'Z',
        reportDate,
        generatedAt: new Date().toISOString(),
        summary: {
          totalOrders,
          grossTotal: grossTotal.toFixed(2),
          totalDiscount: totalDiscount.toFixed(2),
          totalTax: totalTax.toFixed(2),
          netTotal: totalSales.toFixed(2),
          averageOrderValue: totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0.00'
        },
        paymentMethods,
        categorySales,
        topProducts,
        hourlySales,
        orders: orders.map(o => ({
          id: o.id,
          order_no: o.order_no,
          created_at: o.created_at,
          updated_at: o.updated_at,
          gross_total: o.gross_total,
          discount: o.discount,
          tax: o.tax,
          net_total: o.net_total
        }))
      };

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Z Report error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate Z Report' });
    }
  },

  /**
   * Get summary of recent daily sales (for history view)
   * Generates summary from orders grouped by date
   */
  getReportHistory: async (req, res) => {
    try {
      const { limit = 30 } = req.query;
      
      // Get daily summaries from orders
      const dailySummaries = await db.all(`
        SELECT 
          DATE(updated_at) as report_date,
          COUNT(*) as total_orders,
          SUM(gross_total) as gross_total,
          SUM(discount) as total_discount,
          SUM(tax) as total_tax,
          SUM(net_total) as net_total,
          MAX(updated_at) as last_order_time
        FROM orders
        WHERE status IN ('completed', 'paid')
        GROUP BY DATE(updated_at)
        ORDER BY report_date DESC
        LIMIT $1
      `, [parseInt(limit)]);
      
      const formattedReports = dailySummaries.map(r => ({
        reportDate: r.report_date,
        generatedAt: r.last_order_time,
        summary: {
          totalOrders: r.total_orders,
          grossTotal: r.gross_total.toFixed(2),
          totalDiscount: r.total_discount.toFixed(2),
          totalTax: r.total_tax.toFixed(2),
          netTotal: r.net_total.toFixed(2),
          averageOrderValue: (r.net_total / r.total_orders).toFixed(2)
        }
      }));

      res.json({ success: true, data: formattedReports });
    } catch (error) {
      console.error('Report history error:', error);
      res.status(500).json({ success: false, error: 'Failed to get report history' });
    }
  }
};

module.exports = ReportController;
