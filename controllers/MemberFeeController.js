const MemberFee = require('../models/MemberFee');

const MemberFeeController = {
  getAllMemberFees: async (req, res) => {
    try {
      console.log('🚀 getAllMemberFees - Starting...');
      const memberFees = await MemberFee.getAll();
      console.log('📦 getAllMemberFees - raw result from model:', memberFees);
      console.log('📦 getAllMemberFees - JSON stringified:', JSON.stringify(memberFees, null, 2));
      console.log('📦 getAllMemberFees - type:', typeof memberFees, 'isArray:', Array.isArray(memberFees));
      console.log('📦 getAllMemberFees - length:', Array.isArray(memberFees) ? memberFees.length : 'N/A');
      
      if (Array.isArray(memberFees) && memberFees.length > 0) {
        console.log('📦 getAllMemberFees - first item:', memberFees[0]);
        console.log('📦 getAllMemberFees - first item stringified:', JSON.stringify(memberFees[0], null, 2));
        console.log('📦 getAllMemberFees - first item keys:', Object.keys(memberFees[0]));
        console.log('📦 getAllMemberFees - first item values:', Object.values(memberFees[0]));
        // Check all possible property names
        console.log('📦 getAllMemberFees - first item.member_fee:', memberFees[0].member_fee);
        console.log('📦 getAllMemberFees - first item.fee_amount:', memberFees[0].fee_amount);
        console.log('📦 getAllMemberFees - first item properties:', Object.getOwnPropertyNames(memberFees[0]));
      } else {
        console.log('⚠️ getAllMemberFees - Empty array or not an array');
      }
      
      const response = { data: memberFees };
      console.log('📤 getAllMemberFees - Sending response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (err) {
      console.error('❌ Error getting member fees:', err);
      console.error('❌ Error stack:', err.stack);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  },

  getMemberFeeById: async (req, res) => {
    try {
      const id = req.params.id;
      const memberFee = await MemberFee.getById(id);
      if (!memberFee) {
        return res.status(404).json({ error: 'Member fee not found' });
      }
      res.json({ data: memberFee });
    } catch (err) {
      console.error('Error getting member fee by id:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createMemberFee: async (req, res) => {
    try {
      const { member_fee } = req.body;
      if (member_fee === undefined || member_fee === null || member_fee === '') {
        return res.status(400).json({ error: 'Member fee is required' });
      }

      const newMemberFee = await MemberFee.create(member_fee);
      res.status(201).json({
        message: 'Member fee created successfully',
        data: newMemberFee
      });
    } catch (err) {
      console.error('Error creating member fee:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateMemberFee: async (req, res) => {
    try {
      const id = req.params.id;
      const { member_fee } = req.body;
      if (member_fee === undefined || member_fee === null || member_fee === '') {
        return res.status(400).json({ error: 'Member fee is required' });
      }

      const updatedMemberFee = await MemberFee.update(id, member_fee);
      res.status(200).json({
        message: 'Member fee updated successfully',
        data: updatedMemberFee
      });
    } catch (err) {
      console.error('Error updating member fee:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deleteMemberFee: async (req, res) => {
    try {
      const id = req.params.id;
      await MemberFee.delete(id);
      res.json({ message: 'Member fee deleted successfully' });
    } catch (err) {
      console.error('Delete member fee error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = MemberFeeController;
