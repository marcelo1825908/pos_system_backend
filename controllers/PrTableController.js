const PrTable = require('../models/PrTable');

const PrTableController = {
    getAllPrTables: (req, res) => {
        try {
            const tables = PrTable.getAll();
            res.json({ data: tables });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getPrTableById: (req, res) => {
        try {
            
            const id = req.params.id;
            const table = PrTable.getById(id);
            if (!table) {
                return res.status(404).json({ error: 'Table not found' });
            }
            res.json({ data: table });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createPrTable: (req, res) => {
        try {
            const { table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size } = req.body;
            if (!table_no) {
                return res.status(400).json({ error: 'Table number is required' });
            }

            const table = PrTable.create(
                table_no, 
                room_id || null, 
                order_id || null, 
                status || 'available', 
                description || '',
                customer_name || null,
                waiter_name || null,
                table_size || null
            );
            res.status(201).json({
                message: 'Table created successfully',
                data: table
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updatePrTable: (req, res) => {
        try {
            const id = req.params.id;
            const { table_no, room_id, order_id, status, description, customer_name, waiter_name, table_size } = req.body;
            if (!table_no) {
                return res.status(400).json({ error: 'Table number is required' });
            }

            const table = PrTable.update(
                id, 
                table_no, 
                room_id || null, 
                order_id || null, 
                status || 'available', 
                description || '',
                customer_name || null,
                waiter_name || null,
                table_size || null
            );
            res.status(200).json({
                message: 'Table updated successfully',
                data: table
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deletePrTable: (req, res) => {
        try {
            const id = req.params.id;
            PrTable.delete(id);
            res.json({ message: 'Table deleted successfully' });
        } catch (err) {
            console.error('Delete table error:', err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = PrTableController;
