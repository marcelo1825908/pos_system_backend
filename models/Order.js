const db = require('../config/database');

class Order {
    static async create(order, details) {
        // Generate order_no
        const orderNo = `ORD-${String(Date.now()).slice(-6)}`;
        
        // Set completed_at if order is created with completed/paid status
        const status = order.status || 'pending';
        const completedAt = (status === 'completed' || status === 'paid') 
            ? new Date().toISOString() 
            : null;
    
        const sql = `
      INSERT INTO orders (tax, status, note, gross_total, net_total, discount, table_id, customer_id, order_no, order_type, completed_at, employee_id, device_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

        const result = await db.run(sql, [
            order.tax || 0,
            status,
            order.note || '',
            order.sub_total || 0,
            order.total || 0,
            order.discount || 0,
            order.table_id || null,
            order.customer_id || null,
            orderNo,
            order.order_type || 'horeca',
            completedAt,
            order.employee_id || null,
            order.device_id || null
        ]);

        const orderId = result.lastInsertRowid;

        if (details && details.length > 0) {
            for (const row of details) {
                await db.run(`
                    INSERT INTO order_details (order_id, product_id, qty, total, notes, discount)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    orderId, 
                    row.product_id, 
                    row.qty, 
                    row.total,
                    row.notes || null,
                    row.discount || 0
                ]);
            }
        }
        return { id: orderId, order_no: orderNo, ...order, details };
    }

    static async update(id, payload, items) {
        const existing = await Order.getById(id);
        if (!existing) return null;

        // Delete only old order details
        await db.run('DELETE FROM order_details WHERE order_id = $1', [id]);

        // Check if status is changing to completed/paid and set completed_at
        const newStatus = payload.status || 'pending';
        const oldStatus = existing.status;
        let completedAt = existing.completed_at;
        
        // Set completed_at when order is marked as completed or paid for the first time
        if ((newStatus === 'completed' || newStatus === 'paid') && 
            (oldStatus !== 'completed' && oldStatus !== 'paid')) {
            completedAt = new Date().toISOString();
        }

        // Update the order record
        await db.run(`
        UPDATE orders
        SET tax = $1, status = $2, note = $3, net_total = $4, gross_total = $5, discount = $6, table_id = $7, customer_id = $8, order_type = $9, completed_at = $10, employee_id = $11, device_id = $12
        WHERE id = $13
        `, [
            payload.tax || 0,
            newStatus,
            payload.note || '',
            payload.total || 0,
            payload.sub_total || 0,
            payload.discount || 0,
            payload.table_id || null,
            payload.customer_id || null,
            payload.order_type || existing.order_type || 'horeca',
            completedAt,
            payload.employee_id || null,
            payload.device_id || existing.device_id || null,
            id
        ]);

        // Insert new order details
        if (items && items.length > 0) {
            for (const item of items) {
                await db.run(`
                    INSERT INTO order_details (order_id, product_id, qty, total, notes, discount)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    id, 
                    item.product_id, 
                    item.qty, 
                    item.total,
                    item.notes || null,
                    item.discount || 0
                ]);
            }
        }

        return await Order.getById(id);
    }

    static async getAll() {
        const orders = await db.all('SELECT * FROM orders ORDER BY id DESC');
        for (const order of orders) {
            // Map database column names to expected property names
            order.sub_total = order.gross_total;
            order.total = order.net_total;
            // discount field is already correctly named
            delete order.gross_total;
            delete order.net_total;
            
            order.details = await db.all(
                `SELECT od.*, p.name as product_name, p.price
           FROM order_details od
           LEFT JOIN products p ON od.product_id = p.id
           WHERE od.order_id = $1`,
                [order.id]
            );
        }
        return orders;
    }

    static async getById(id) {
        const order = await db.get('SELECT * FROM orders WHERE id = $1', [id]);
        if (!order) return null;
        
        // Map database column names to expected property names
        order.sub_total = order.gross_total;
        order.total = order.net_total;
        // discount field is already correctly named
        delete order.gross_total;
        delete order.net_total;
        
        order.details = await db.all(
            `SELECT od.*, p.name as product_name, p.price
         FROM order_details od
         LEFT JOIN products p ON od.product_id = p.id
         WHERE od.order_id = $1`,
            [id]
        );
        return order;
    }

    static async delete(id) {
        await db.run('DELETE FROM order_details WHERE order_id = $1', [id]);
        await db.run('DELETE FROM orders WHERE id = $1', [id]);
    }

    static async getByTableId(tableId) {
        const order = await db.get('SELECT * FROM orders WHERE table_id = $1 AND status = $2 ORDER BY id DESC LIMIT 1', [tableId, 'send_kitchen']);
        if (!order) return null;
        
        // Map database column names to expected property names
        order.sub_total = order.gross_total;
        order.total = order.net_total;
        delete order.gross_total;
        delete order.net_total;
        
        order.details = await db.all(
            `SELECT od.*, p.name as product_name, p.price, p.color, p.image
         FROM order_details od
         LEFT JOIN products p ON od.product_id = p.id
         WHERE od.order_id = $1`,
            [order.id]
        );
        return order;
    }

    static async getHoldOrders(employeeId = null) {
        let orders;
        if (employeeId) {
            orders = await db.all('SELECT * FROM orders WHERE status = $1 AND employee_id = $2 ORDER BY id DESC', ['on_hold', employeeId]);
        } else {
            orders = await db.all('SELECT * FROM orders WHERE status = $1 ORDER BY id DESC', ['on_hold']);
        }
        
        for (const order of orders) {
            // Map database column names to expected property names
            order.sub_total = order.gross_total;
            order.total = order.net_total;
            delete order.gross_total;
            delete order.net_total;
            
            order.details = await db.all(
                `SELECT od.*, p.name as product_name, p.price, p.color, p.image
           FROM order_details od
           LEFT JOIN products p ON od.product_id = p.id
           WHERE od.order_id = $1`,
                [order.id]
            );
        }
        return orders;
    }
}

module.exports = Order;
