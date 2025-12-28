const db = require('../config/database');

// SubProduct model: basic CRUD operations
class SubProduct {
    static async getAll(filters = {}) {
        let sql = `
      SELECT sp.*, c.name as category_name, g.name as group_name
      FROM sub_products sp
      LEFT JOIN categories c ON sp.category_id = c.id
      LEFT JOIN groups g ON sp.group_id = g.id
    `;
        
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Filter by group_id if provided
        if (filters.group_id !== undefined && filters.group_id !== null) {
            conditions.push(`sp.group_id = $${paramIndex}`);
            params.push(filters.group_id);
            paramIndex++;
        }

        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY sp.display_index ASC, sp.id ASC';

        return params.length > 0 
            ? await db.all(sql, params)
            : await db.all(sql);
    }

    static async getById(id) {
        const sql = `
      SELECT sp.*, c.name as category_name, g.name as group_name
      FROM sub_products sp
      LEFT JOIN categories c ON sp.category_id = c.id
      LEFT JOIN groups g ON sp.group_id = g.id
      WHERE sp.id = $1
    `;
        return await db.get(sql, [id]);
    }

    static async getByProductId(productId) {
        const sql = `
      SELECT sp.*, c.name as category_name, g.name as group_name
      FROM sub_products sp
      LEFT JOIN categories c ON sp.category_id = c.id
      LEFT JOIN groups g ON sp.group_id = g.id
      INNER JOIN product_sub_products psp ON sp.id = psp.sub_product_id
      WHERE psp.product_id = $1
      ORDER BY sp.display_index ASC, sp.id ASC
    `;
        return await db.all(sql, [productId]);
    }

    static async create(subProduct) {
        const sql = `INSERT INTO sub_products (
      group_id, product_id, name, button_name, production_name, price, vat_takeout, vat_eat_in,
      barcode, category_id, addition_type, display_index, in_web_shop,
      printer1, printer2, printer3, image, color, price_vat_inc
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id`;

        const params = [
            subProduct.group_id || null,
            subProduct.product_id || null,
            subProduct.name,
            subProduct.button_name || null,
            subProduct.production_name || null,
            subProduct.price || 0,
            subProduct.vat_takeout || 0,
            subProduct.vat_eat_in || 0,
            subProduct.barcode || null,
            subProduct.category_id || null,
            subProduct.addition_type || null,
            subProduct.display_index || 0,
            subProduct.in_web_shop || 0,
            subProduct.printer1 || null,
            subProduct.printer2 || null,
            subProduct.printer3 || null,
            subProduct.image || null,
            subProduct.color || '#3b82f6',
            subProduct.price_vat_inc || 0
        ];

        const result = await db.run(sql, params);
        return { id: result.lastInsertRowid, ...subProduct };
    }

    static async update(id, subProduct) {
        const sql = `UPDATE sub_products SET
      group_id = $1, product_id = $2, name = $3, button_name = $4, production_name = $5, price = $6, vat_takeout = $7, vat_eat_in = $8,
      barcode = $9, category_id = $10, addition_type = $11, display_index = $12, in_web_shop = $13,
      printer1 = $14, printer2 = $15, printer3 = $16, image = $17, color = $18, price_vat_inc = $19
      WHERE id = $20`;

        const params = [
            subProduct.group_id || null,
            subProduct.product_id || null,
            subProduct.name,
            subProduct.button_name || null,
            subProduct.production_name || null,
            subProduct.price || 0,
            subProduct.vat_takeout || 0,
            subProduct.vat_eat_in || 0,
            subProduct.barcode || null,
            subProduct.category_id || null,
            subProduct.addition_type || null,
            subProduct.display_index || 0,
            subProduct.in_web_shop || 0,
            subProduct.printer1 || null,
            subProduct.printer2 || null,
            subProduct.printer3 || null,
            subProduct.image || null,
            subProduct.color || '#3b82f6',
            subProduct.price_vat_inc || 0,
            id
        ];

        await db.run(sql, params);
        return { id, ...subProduct };
    }

    static async delete(id) {
        // Check if sub-product is used in any orders
        const checkOrders = 'SELECT COUNT(*) as count FROM order_details WHERE product_id = $1';
        const orderCount = await db.get(checkOrders, [id]);
        
        if (parseInt(orderCount.count) > 0) {
            throw new Error(`Cannot delete sub-product: This sub-product has been used in ${orderCount.count} order(s)`);
        }

        const sql = 'DELETE FROM sub_products WHERE id = $1';
        return await db.run(sql, [id]);
    }
}

module.exports = SubProduct;
