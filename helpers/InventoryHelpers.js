// const db = require('../config/database');

// const InventoryHelper = {

//   getAvailableQty: (productId) => {
//     // total inventory
//     const inventory = db.prepare(`SELECT qty FROM inventory WHERE product_id = ?`).get(productId);
//     const totalQty = inventory ? inventory.qty : 0;

//     // used qty in orders
//     const usedRow = db.prepare(`
//       SELECT SUM(qty) as usedQty
//       FROM order_details od
//       JOIN orders o ON o.id = od.order_id
//       WHERE od.product_id = ? AND o.status != 'cancelled'
//     `).get(productId);

//     const usedQty = usedRow ? usedRow.usedQty || 0 : 0;

//     return totalQty - usedQty;
//   }

// };

// module.exports = InventoryHelper;

const db = require('../config/database');

const InventoryHelper = {

  /**
   * Get available quantity for a product
   * @param {number} productId - The product ID
   * @param {number|null} excludeOrderId - Optional order ID to exclude from calculation (for editing)
   * @returns {number} Available quantity
   */
  getAvailableQty: async (productId, excludeOrderId = null) => {
    // Get total inventory
    const inventory = await db.get(`SELECT qty FROM inventory WHERE product_id = $1`, [productId]);
    const totalQty = inventory ? inventory.qty : 0;

    // Get used qty in ALL active orders (exclude cancelled and optionally a specific order)
    let query = `
      SELECT SUM(od.qty) as usedQty
      FROM order_details od
      JOIN orders o ON o.id = od.order_id
      WHERE od.product_id = $1
        AND o.status != 'cancelled'
        AND o.order_type = 'retail'
    `;
    
    const params = [productId];
    
    // If editing an order, exclude it from the calculation
    if (excludeOrderId) {
      query += ` AND o.id != $2`;
      params.push(excludeOrderId);
    }

    const usedRow = await db.get(query, params);
    const usedQty = usedRow ? usedRow.usedqty || 0 : 0;

    return totalQty - usedQty;
  },

  /**
   * Validate if requested quantity is available
   * @param {number} productId - The product ID
   * @param {number} requestedQty - Quantity requested
   * @param {number|null} excludeOrderId - Optional order ID to exclude (for editing)
   * @returns {object} Validation result with valid flag, availableQty, and message
   */
  validateQty: async (productId, requestedQty, excludeOrderId = null) => {
    const availableQty = await InventoryHelper.getAvailableQty(productId, excludeOrderId);
    if (requestedQty > availableQty) {
      return {
        valid: false,
        availableQty,
        message: `Requested quantity (${requestedQty}) exceeds available stock (${availableQty})`
      };
    }
    return { valid: true, availableQty };
  },

  /**
   * Validate all items in an order
   * @param {Array} items - Array of order items with product_id and qty
   * @param {number|null} excludeOrderId - Optional order ID to exclude (for editing)
   * @returns {object} Validation result with valid flag and errors array
   */
  validateOrderItems: async (items, excludeOrderId = null) => {
    const errors = [];
    
    for (const item of items) {
      const validation = await InventoryHelper.validateQty(item.product_id, item.qty, excludeOrderId);
      if (!validation.valid) {
        // Get product name for better error message
        const product = await db.get(`SELECT name FROM products WHERE id = $1`, [item.product_id]);
        errors.push({
          product_id: item.product_id,
          product_name: product ? product.name : `Product ${item.product_id}`,
          requested: item.qty,
          available: validation.availableQty,
          message: validation.message
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

};

module.exports = InventoryHelper;
