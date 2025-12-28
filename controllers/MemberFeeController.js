const MemberFee = require('../models/MemberFee');

const MemberFeeController = {
  getAllMemberFees: (req, res) => {
    try {
      const memberFees = MemberFee.getAll();
      res.json({ data: memberFees });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getMemberFeeById: (req, res) => {
    try {
      const id = req.params.id;
      const memberFee = MemberFee.getById(id);
      if (!memberFee) {
        return res.status(404).json({ error: 'Member fee not found' });
      }
      res.json({ data: memberFee });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createMemberFee: (req, res) => {
    try {
      const { member_fee } = req.body;
      if (member_fee === undefined || member_fee === null || member_fee === '') {
        return res.status(400).json({ error: 'Member fee is required' });
      }

      const newMemberFee = MemberFee.create(member_fee);
      res.status(201).json({
        message: 'Member fee created successfully',
        data: newMemberFee
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateMemberFee: (req, res) => {
    try {
      const id = req.params.id;
      const { member_fee } = req.body;
      if (member_fee === undefined || member_fee === null || member_fee === '') {
        return res.status(400).json({ error: 'Member fee is required' });
      }

      const updatedMemberFee = MemberFee.update(id, member_fee);
      res.status(200).json({
        message: 'Member fee updated successfully',
        data: updatedMemberFee
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteMemberFee: (req, res) => {
    try {
      const id = req.params.id;
      MemberFee.delete(id);
      res.json({ message: 'Member fee deleted successfully' });
    } catch (err) {
      console.error('Delete member fee error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = MemberFeeController;
