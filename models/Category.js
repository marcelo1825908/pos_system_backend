const db = require('../config/database');

class Category {
  static async getAll(filters = {}) {
    let sql = 'SELECT * FROM categories';
    const params = [];
    
    // Apply is_visible filter if provided
    if (filters.is_visible !== undefined && filters.is_visible !== null) {
      sql += ' WHERE is_visible = $1';
      params.push(filters.is_visible ? 1 : 0);
    }
    
    sql += ' ORDER BY display_order ASC, id ASC';
    
    return params.length > 0 
      ? await db.all(sql, params)
      : await db.all(sql);
  }

  static async getById(id) {
    const sql = 'SELECT * FROM categories WHERE id = $1';
    return await db.get(sql, [id]);
  }

  static async create(name, next_course = 0, in_web_shop = 0, is_visible = 1) {
    // Get the max display_order and add 1
    const maxOrder = await db.get('SELECT MAX(display_order) as max FROM categories');
    const display_order = (maxOrder?.max || 0) + 1;
    
    const sql = 'INSERT INTO categories (name, next_course, in_web_shop, display_order, is_visible) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const result = await db.run(sql, [name, next_course, in_web_shop, display_order, is_visible ? 1 : 0]);
    return { id: result.lastInsertRowid, name, next_course, in_web_shop, display_order, is_visible: is_visible ? 1 : 0 };
  }

  static async update(id, name, next_course = 0, in_web_shop = 0, is_visible = 1) {
    const sql = 'UPDATE categories SET name = $1, next_course = $2, in_web_shop = $3, is_visible = $4 WHERE id = $5';
    await db.run(sql, [name, next_course, in_web_shop, is_visible ? 1 : 0, id]);
    return { id, name, next_course, in_web_shop, is_visible: is_visible ? 1 : 0 };
  }

  static async delete(id) {
    // Check if category has products (including sub-products which are now in products table)
    const checkProducts = 'SELECT COUNT(*) as count FROM products WHERE category_id = $1';
    const productCount = await db.get(checkProducts, [id]);
    
    if (parseInt(productCount.count) > 0) {
      throw new Error(`Cannot delete category: ${productCount.count} product(s) are using this category`);
    }

    const sql = 'DELETE FROM categories WHERE id = $1';
    return await db.run(sql, [id]);
  }

  static async moveUp(id) {
    const current = await this.getById(id);
    if (!current) return null;

    // Find the category with the next lower display_order
    const sql = 'SELECT * FROM categories WHERE display_order < $1 ORDER BY display_order DESC LIMIT 1';
    const previous = await db.get(sql, [current.display_order]);
    
    if (!previous) return null; // Already at the top

    // Swap display_order values
    const updateCurrent = 'UPDATE categories SET display_order = $1 WHERE id = $2';
    const updatePrevious = 'UPDATE categories SET display_order = $1 WHERE id = $2';
    
    await db.run(updateCurrent, [previous.display_order, current.id]);
    await db.run(updatePrevious, [current.display_order, previous.id]);
    
    return { current, previous };
  }

  static async moveDown(id) {
    const current = await this.getById(id);
    if (!current) return null;

    // Find the category with the next higher display_order
    const sql = 'SELECT * FROM categories WHERE display_order > $1 ORDER BY display_order ASC LIMIT 1';
    const next = await db.get(sql, [current.display_order]);
    
    if (!next) return null; // Already at the bottom

    // Swap display_order values
    const updateCurrent = 'UPDATE categories SET display_order = $1 WHERE id = $2';
    const updateNext = 'UPDATE categories SET display_order = $1 WHERE id = $2';
    
    await db.run(updateCurrent, [next.display_order, current.id]);
    await db.run(updateNext, [current.display_order, next.id]);
    
    return { current, next };
  }
}

module.exports = Category;
