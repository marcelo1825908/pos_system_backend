const Member = require('../models/Member');

const MemberController = {
  getAllMembers: async (req, res) => {
    try {
      const members = await Member.getAll();
      // Ensure we always return an array
      res.json(Array.isArray(members) ? members : []);
    } catch (error) {
      console.error('Get all members error:', error);
      // Return empty array on error instead of error object
      res.json([]);
    }
  },

  getMemberById: async (req, res) => {
    try {
      const member = await Member.getById(req.params.id);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getNextMemberId: async (req, res) => {
    try {
      const nextId = await Member.getNextMemberId();
      res.json({ nextMemberId: nextId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  searchMembers: async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.json([]);
      }
      const members = await Member.search(q);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createMember: async (req, res) => {
    try {
      const { full_name, phone, email, address, member_id } = req.body;
      
      if (!full_name) {
        return res.status(400).json({ error: 'Full name is required' });
      }

      const newMember = await Member.create(full_name, phone, email, address, member_id);
      res.status(201).json(newMember);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateMember: async (req, res) => {
    try {
      const { full_name, phone, email, address, member_id } = req.body;
      
      const updatedMember = await Member.update(
        req.params.id, 
        full_name, 
        phone, 
        email, 
        address,
        member_id
      );

      if (!updatedMember) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json(updatedMember);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteMember: async (req, res) => {
    try {
      await Member.delete(req.params.id);
      res.json({ message: 'Member deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = MemberController;
