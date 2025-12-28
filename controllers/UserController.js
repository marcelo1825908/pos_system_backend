const User = require('../models/User');

const UserController = {
  getAllUsers: (req, res) => {
    try {
      const users = User.getAll();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUserById: (req, res) => {
    try {
      const user = User.getById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createUser: (req, res) => {
    try {
      const { name, pincode, social_security, identification, role, avatar_color, permissions } = req.body;
      
      if (!name || !pincode) {
        return res.status(400).json({ error: 'Name and pincode are required' });
      }

      const newUser = User.create(name, pincode, social_security, identification, role, avatar_color, permissions || '[]');
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateUser: (req, res) => {
    try {
      const { name, pincode, social_security, identification, role, avatar_color, permissions } = req.body;
      
      const updatedUser = User.update(
        req.params.id, 
        name, 
        pincode, 
        social_security, 
        identification, 
        role, 
        avatar_color,
        permissions || '[]'
      );

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updatePermissions: (req, res) => {
    try {
      const { permissions } = req.body;
      
      if (!permissions) {
        return res.status(400).json({ error: 'Permissions are required' });
      }

      const updatedUser = User.updatePermissions(req.params.id, permissions);

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteUser: (req, res) => {
    try {
      const result = User.delete(req.params.id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyPincode: (req, res) => {
    try {
      const { userId, pincode } = req.body;
      const user = User.verifyPincode(userId, pincode);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid pincode' });
      }

      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyByNameAndPincode: (req, res) => {
    try {
      const { name, pincode } = req.body;
      
      if (!name || !pincode) {
        return res.status(400).json({ error: 'Name and pincode are required' });
      }

      const user = User.verifyByNameAndPincode(name, pincode);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = UserController;