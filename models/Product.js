const db = require('../config/database');

// Product model: basic CRUD operations
class Product {
    static async getAll() {
        const sql = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.display_index ASC, p.id ASC`;
        return await db.all(sql);
    }

    static async getById(id) {
        const sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `;
        return await db.get(sql, [id]);
    }

    static async create(product) {
        // Check if barcode already exists (if provided)
        if (product.barcode && product.barcode.trim() !== '') {
            const existing = await db.get('SELECT id FROM products WHERE barcode = $1', [product.barcode]);
            if (existing) {
                throw new Error(`Barcode "${product.barcode}" already exists for another product`);
            }
        }

        const sql = `INSERT INTO products (
      name, button_name, production_name, price, vat_takeout, vat_eat_in,
      barcode, category_id, addition_type, display_index, in_web_shop,
      printer1, printer2, printer3, image, color, price_vat_inc, sub_product_group,
      is_weight_based, weight_unit, price_per_unit, minimum_weight, maximum_weight, tare_weight
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    RETURNING id`;

        const params = [
            product.name,
            product.button_name || null,
            product.production_name || null,
            product.price || 0,
            product.vat_takeout || 0,
            product.vat_eat_in || 0,
            product.barcode || null,
            product.category_id || null,
            product.addition_type || null,
            product.display_index || 0,
            product.in_web_shop || 0,
            product.printer1 || null,
            product.printer2 || null,
            product.printer3 || null,
            product.image || null,
            product.color || '#3b82f6',
            product.price_vat_inc || 0,
            product.sub_product_group || 0,
            product.is_weight_based || 0,
            product.weight_unit || 'kg',
            product.price_per_unit || 0,
            product.minimum_weight || 0,
            product.maximum_weight || 0,
            product.tare_weight || 0
        ];

        const result = await db.run(sql, params);
        return { id: result.lastInsertRowid, ...product };
    }

    static async update(id, product) {
        // Check if barcode already exists for another product (if provided)
        if (product.barcode && product.barcode.trim() !== '') {
            const existing = await db.get('SELECT id FROM products WHERE barcode = $1 AND id != $2', [product.barcode, id]);
            if (existing) {
                throw new Error(`Barcode "${product.barcode}" already exists for another product`);
            }
        }

        const sql = `UPDATE products SET
      name = $1, button_name = $2, production_name = $3, price = $4, vat_takeout = $5, vat_eat_in = $6,
      barcode = $7, category_id = $8, addition_type = $9, display_index = $10, in_web_shop = $11,
      printer1 = $12, printer2 = $13, printer3 = $14, image = $15, color = $16, price_vat_inc = $17, sub_product_group = $18,
      is_weight_based = $19, weight_unit = $20, price_per_unit = $21, minimum_weight = $22, maximum_weight = $23, tare_weight = $24
      WHERE id = $25`;

        const params = [
            product.name,
            product.button_name || null,
            product.production_name || null,
            product.price || 0,
            product.vat_takeout || 0,
            product.vat_eat_in || 0,
            product.barcode || null,
            product.category_id || null,
            product.addition_type || null,
            product.display_index || 0,
            product.in_web_shop || 0,
            product.printer1 || null,
            product.printer2 || null,
            product.printer3 || null,
            product.image || null,
            product.color || '#3b82f6',
            product.price_vat_inc || 0,
            product.sub_product_group || 0,
            product.is_weight_based || 0,
            product.weight_unit || 'kg',
            product.price_per_unit || 0,
            product.minimum_weight || 0,
            product.maximum_weight || 0,
            product.tare_weight || 0,
            id
        ];

        await db.run(sql, params);
        return { id, ...product };
    }

    static async delete(id) {
        // Check if product has sub-products linked to it via junction table
        const checkSubProducts = 'SELECT COUNT(*) as count FROM product_sub_products WHERE product_id = $1';
        const subProductCount = await db.get(checkSubProducts, [id]);
        
        if (parseInt(subProductCount.count) > 0) {
            throw new Error(`Cannot delete product: ${subProductCount.count} sub-product(s) are linked to this product`);
        }

        // Check if product is used in any orders
        const checkOrders = 'SELECT COUNT(*) as count FROM order_details WHERE product_id = $1';
        const orderCount = await db.get(checkOrders, [id]);
        
        if (parseInt(orderCount.count) > 0) {
            throw new Error(`Cannot delete product: This product has been used in ${orderCount.count} order(s)`);
        }

        const sql = 'DELETE FROM products WHERE id = $1';
        return await db.run(sql, [id]);
    }

    static async getByBarcode(barcode) {
        const sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = $1
    `;
        return await db.get(sql, [barcode]);
    }
}

module.exports = Product;
