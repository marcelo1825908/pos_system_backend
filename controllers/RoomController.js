const Room = require('../models/Room');

const RoomController = {
    getAllRooms: (req, res) => {
        try {
            const rooms = Room.getAll();
            res.json({ data: rooms });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getRoomById: (req, res) => {
        try {
            const id = req.params.id;
            const room = Room.getById(id);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }
            res.json({ data: room });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createRoom: (req, res) => {
        try {
            const { name, total_table } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const room = Room.create(name, total_table || 0);
            res.status(201).json({
                message: 'Room created successfully',
                data: room
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateRoom: (req, res) => {
        try {
            const id = req.params.id;
            const { name, total_table } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const room = Room.update(id, name, total_table || 0);
            res.status(200).json({
                message: 'Room updated successfully',
                data: room
            });
        } catch (err) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deleteRoom: (req, res) => {
        try {
            const id = req.params.id;
            Room.delete(id);
            res.json({ message: 'Room deleted successfully' });
        } catch (err) {
            console.error('Delete room error:', err);
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = RoomController;
