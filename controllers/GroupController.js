const Group = require('../models/Group');

const GroupController = {
  getAllGroups: (req, res) => {
    try {
      const groups = Group.getAll();
      res.json({ data: groups });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getGroupById: (req, res) => {
    try {
      const id = req.params.id;
      const group = Group.getById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json({ data: group });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createGroup: (req, res) => {
    try {
      const { name, is_visible } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const group = Group.create(name, is_visible);
      res.status(201).json({
        message: 'Group created successfully',
        data: group
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateGroup: (req, res) => {
    try {
      const id = req.params.id;
      const { name, is_visible } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const group = Group.update(id, name, is_visible);
      res.status(200).json({
        message: 'Group updated successfully',
        data: group
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteGroup: (req, res) => {
    try {
      const id = req.params.id;
      Group.delete(id);
      res.json({ message: 'Group deleted successfully' });
    } catch (err) {
      console.error('Delete group error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = GroupController;
