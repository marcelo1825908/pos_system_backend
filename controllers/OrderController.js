const Order = require('../models/Order');
const InventoryHelper = require('../helpers/InventoryHelpers');

const OrderController = {
    getAllOrders: async (req, res) => {
        try {
            const orders = await Order.getAll();
            res.json({ data: orders });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getOrderById: async (req, res) => {
        try {
            const id = req.params.id;
            const order = await Order.getById(id);
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            res.json({ data: order });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createOrder: async (req, res) => {
        try {
            const { tax, status, note, sub_total, total, discount, details, table_id, customer_id, employee_id, order_type, device_id } = req.body;
            console.log('📝 Creating order with', details?.length, 'items, type:', order_type);

            if (!details || !Array.isArray(details) || details.length === 0) {
                return res.status(400).json({ error: 'Order must have at least one item' });
            }

            // Only validate inventory for retail orders
            if (order_type === 'retail') {
                const validation = await InventoryHelper.validateOrderItems(details);
                console.log('✅ Inventory validation result (retail):', validation);
                
                if (!validation.valid) {
                    console.log('❌ Order creation blocked - insufficient inventory');
                    return res.status(400).json({ 
                        error: 'Insufficient inventory',
                        details: validation.errors
                    });
                }
            } else {
                console.log('⏭️ Skipping inventory validation for order type:', order_type);
            }

            const order = { tax, status, note, sub_total, total, discount, table_id, customer_id, order_type, employee_id, device_id };
            const newOrder = await Order.create(order, details);

            res.status(201).json({ message: 'Order created successfully', data: newOrder });
        } catch (error) {
            console.error('❌ Error creating order:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    },

    updateOrder: async (req, res) => {
        try {
            const id = req.params.id;
            const { tax, status, note, total, sub_total, discount, details, table_id, customer_id, order_type, employee_id, device_id } = req.body;

            console.log('📝 Updating order', id, 'with', details?.length, 'items, type:', order_type);

            // Check if order exists
            const existingOrder = await Order.getById(id);
            if (!existingOrder) {
                return res.status(404).json({ error: 'Order not found' });
            }
       
            // Only validate inventory for retail orders
            const finalOrderType = order_type || existingOrder.order_type || 'horeca';
            if (finalOrderType === 'retail') {
                const validation = await InventoryHelper.validateOrderItems(details, id);
                console.log('✅ Inventory validation result (retail, excluding order', id, '):', validation);
                
                if (!validation.valid) {
                    console.log('❌ Order update blocked - insufficient inventory');
                    return res.status(400).json({ 
                        error: 'Insufficient inventory',
                        details: validation.errors
                    });
                }
            } else {
                console.log('⏭️ Skipping inventory validation for order type:', finalOrderType);
            }

            const order = await Order.update(id, { tax, status, note, total, sub_total, discount, table_id, customer_id, employee_id, order_type: finalOrderType, device_id }, details);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            res.json({ message: 'Order updated successfully', data: order });
        } catch (err) {
            console.error('❌ Error updating order:', err);
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    },


    deleteOrder: async (req, res) => {
        try {
            const id = req.params.id;
            const order = await Order.getById(id);
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            await Order.delete(id);
            res.json({ message: 'Order deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getOrderByTableId: async (req, res) => {
        try {
            const tableId = req.params.tableId;
            const order = await Order.getByTableId(tableId);
            if (!order) {
                return res.json({ data: null });
            }
            res.json({ data: order });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getHoldOrders: async (req, res) => {
        try {
            const employeeId = req.query.employee_id ? parseInt(req.query.employee_id) : null;
            const orders = await Order.getHoldOrders(employeeId);
            res.json({ data: orders });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },
};

module.exports = OrderController;
