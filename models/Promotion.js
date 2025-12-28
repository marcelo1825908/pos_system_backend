const db = require('../config/database');

class Promotion {
  static async getAll() {
    const promotions = await db.all(`
      SELECT * FROM promotions ORDER BY created_at DESC
    `);
    
    // Get products for each promotion with prices
    for (const promo of promotions) {
      const products = await db.all(`
        SELECT p.id, p.name, p.price
        FROM products p
        INNER JOIN promotion_products pp ON p.id = pp.product_id
        WHERE pp.promotion_id = $1
      `, [promo.id]);
      
      promo.products = products;
      promo.product_names = products.map(p => p.name).join(', ');
      promo.product_ids = products.map(p => p.id);
    }
    
    return promotions;
  }

  static async getById(id) {
    const promotion = await db.get('SELECT * FROM promotions WHERE id = $1', [id]);
    
    if (promotion) {
      const products = await db.all(`
        SELECT p.id, p.name, p.price
        FROM products p
        INNER JOIN promotion_products pp ON p.id = pp.product_id
        WHERE pp.promotion_id = $1
      `, [id]);
      
      promotion.products = products;
      promotion.product_ids = products.map(p => p.id);
    }
    
    return promotion;
  }

  static async getActiveByProductId(productId) {
    // Use PostgreSQL NOW() for current timestamp
    console.log('🔍 Model: Checking promotion for product:', productId);
    
    // First, let's check if there's ANY promotion for this product (ignoring dates)
    const anyPromotion = await db.all(`
      SELECT p.*, pp.product_id
      FROM promotions p
      INNER JOIN promotion_products pp ON p.id = pp.promotion_id
      WHERE pp.product_id = $1
    `, [productId]);
    
    console.log('📋 Model: All promotions for this product:', anyPromotion);
    
    const sql = `
      SELECT p.*
      FROM promotions p
      INNER JOIN promotion_products pp ON p.id = pp.promotion_id
      WHERE pp.product_id = $1
      AND p.is_active = 1
      AND (p.start_date IS NULL OR p.start_date <= NOW())
      AND (p.end_date IS NULL OR p.end_date >= NOW())
      ORDER BY p.discount_value DESC
      LIMIT 1
    `;
    const promotion = await db.get(sql, [productId]);
    
    console.log('📦 Model: Active promotion query result:', promotion);
    
    if (promotion) {
      // Get all products in this promotion
      const products = await db.all(`
        SELECT p.id, p.name, p.price
        FROM products p
        INNER JOIN promotion_products pp ON p.id = pp.product_id
        WHERE pp.promotion_id = $1
      `, [promotion.id]);
      
      promotion.products = products;
      promotion.product_ids = products.map(p => p.id);
      
      console.log('✅ Model: Promotion with products:', {
        name: promotion.name,
        products: products.map(p => p.name).join(', ')
      });
    } else {
      console.log('⚠️ Model: No active promotion found (check dates and is_active)');
    }
    
    return promotion;
  }

  static async getActiveBillPromotion() {
    console.log('🔍 Model: Checking for active bill-level promotion');
    
    const sql = `
      SELECT p.*
      FROM promotions p
      WHERE p.apply_to = 'entire_order'
      AND p.is_active = 1
      AND (p.start_date IS NULL OR p.start_date <= NOW())
      AND (p.end_date IS NULL OR p.end_date >= NOW())
      ORDER BY p.discount_value DESC
      LIMIT 1
    `;
    const promotion = await db.get(sql);
    
    console.log('📦 Model: Active bill promotion:', promotion);
    
    return promotion;
  }

  static async create(promotion) {
    // Check for overlapping promotions on the same products
    if (promotion.apply_to !== 'entire_order' && promotion.product_ids && promotion.product_ids.length > 0) {
      const placeholders = promotion.product_ids.map((_, i) => `$${i + 1}`).join(',');
      const overlappingCheck = await db.get(`
        SELECT p.name as promotion_name, prod.name as product_name
        FROM promotions p
        INNER JOIN promotion_products pp ON p.id = pp.promotion_id
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE pp.product_id IN (${placeholders})
        AND p.is_active = 1
        AND p.apply_to = 'specific_products'
        AND (
          ($${promotion.product_ids.length + 1}::timestamp IS NULL OR p.end_date IS NULL OR $${promotion.product_ids.length + 1}::timestamp <= p.end_date)
          AND ($${promotion.product_ids.length + 2}::timestamp IS NULL OR p.start_date IS NULL OR $${promotion.product_ids.length + 2}::timestamp >= p.start_date)
        )
        LIMIT 1
      `, [...promotion.product_ids, promotion.start_date || null, promotion.end_date || null]);
      
      if (overlappingCheck) {
        throw new Error(`Product "${overlappingCheck.product_name}" already has an active promotion "${overlappingCheck.promotion_name}" during this time period. Please choose different dates or deactivate the existing promotion.`);
      }
    }
    
    const sql = `
      INSERT INTO promotions (
        name, discount_type, discount_value,
        start_date, end_date, is_active, apply_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const params = [
      promotion.name,
      promotion.discount_type || 'percentage',
      promotion.discount_value || 0,
      promotion.start_date || null,
      promotion.end_date || null,
      promotion.is_active !== undefined ? promotion.is_active : 1,
      promotion.apply_to || 'specific_products'
    ];

    const result = await db.run(sql, params);
    const promotionId = result.lastInsertRowid;
    
    // Insert product associations (only for specific_products)
    if (promotion.apply_to !== 'entire_order' && promotion.product_ids && promotion.product_ids.length > 0) {
      for (const productId of promotion.product_ids) {
        await db.run(`
          INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2)
        `, [promotionId, productId]);
      }
    }
    
    return { id: promotionId, ...promotion };
  }

  static async update(id, promotion) {
    // Check for overlapping promotions on the same products (excluding current promotion)
    if (promotion.apply_to !== 'entire_order' && promotion.product_ids && promotion.product_ids.length > 0) {
      const placeholders = promotion.product_ids.map((_, i) => `$${i + 1}`).join(',');
      const overlappingCheck = await db.get(`
        SELECT p.name as promotion_name, prod.name as product_name
        FROM promotions p
        INNER JOIN promotion_products pp ON p.id = pp.promotion_id
        INNER JOIN products prod ON pp.product_id = prod.id
        WHERE pp.product_id IN (${placeholders})
        AND p.id != $${promotion.product_ids.length + 1}
        AND p.is_active = 1
        AND p.apply_to = 'specific_products'
        AND (
          ($${promotion.product_ids.length + 2}::timestamp IS NULL OR p.end_date IS NULL OR $${promotion.product_ids.length + 2}::timestamp <= p.end_date)
          AND ($${promotion.product_ids.length + 3}::timestamp IS NULL OR p.start_date IS NULL OR $${promotion.product_ids.length + 3}::timestamp >= p.start_date)
        )
        LIMIT 1
      `, [...promotion.product_ids, id, promotion.start_date || null, promotion.end_date || null]);
      
      if (overlappingCheck) {
        throw new Error(`Product "${overlappingCheck.product_name}" already has an active promotion "${overlappingCheck.promotion_name}" during this time period. Please choose different dates or deactivate the existing promotion.`);
      }
    }
    
    const sql = `
      UPDATE promotions SET
        name = $1,
        discount_type = $2,
        discount_value = $3,
        start_date = $4,
        end_date = $5,
        is_active = $6,
        apply_to = $7
      WHERE id = $8
    `;

    const params = [
      promotion.name,
      promotion.discount_type || 'percentage',
      promotion.discount_value || 0,
      promotion.start_date || null,
      promotion.end_date || null,
      promotion.is_active !== undefined ? promotion.is_active : 1,
      promotion.apply_to || 'specific_products',
      id
    ];

    await db.run(sql, params);
    
    // Update product associations
    // First, delete existing associations
    await db.run('DELETE FROM promotion_products WHERE promotion_id = $1', [id]);
    
    // Then insert new associations (only for specific_products)
    if (promotion.apply_to !== 'entire_order' && promotion.product_ids && promotion.product_ids.length > 0) {
      for (const productId of promotion.product_ids) {
        await db.run(`
          INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2)
        `, [id, productId]);
      }
    }
    
    return { id, ...promotion };
  }

  static async delete(id) {
    const sql = 'DELETE FROM promotions WHERE id = $1';
    return await db.run(sql, [id]);
  }
}

module.exports = Promotion;
