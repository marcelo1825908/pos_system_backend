const MosquePayment = require('../models/MosquePayment');

const MosquePaymentController = {
  getAllPayments: async (req, res) => {
    try {
      const payments = await MosquePayment.getAll();
      // Ensure we always return an array
      res.json({ data: Array.isArray(payments) ? payments : [] });
    } catch (err) {
      console.error('Get all mosque payments error:', err);
      res.status(500).json({ data: [] }); // Return empty array on error
    }
  },

  getPaymentById: async (req, res) => {
    try {
      const id = req.params.id;
      const payment = await MosquePayment.getById(id);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      res.json({ data: payment });
    } catch (err) {
      console.error('Get mosque payment by ID error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getPaymentByTransactionId: async (req, res) => {
    try {
      const transactionId = req.params.transactionId;
      const payment = await MosquePayment.getByTransactionId(transactionId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      res.json({ data: payment });
    } catch (err) {
      console.error('Get mosque payment by transaction ID error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getPaymentsByMemberId: async (req, res) => {
    try {
      const memberId = req.params.memberId;
      const payments = await MosquePayment.getByMemberId(memberId);
      res.json({ data: payments });
    } catch (err) {
      console.error('Get mosque payments by member ID error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createPayment: async (req, res) => {
    try {
      const paymentData = req.body;

      // Validate required fields
      if (!paymentData.transaction_id) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }
      if (!paymentData.payment_type) {
        return res.status(400).json({ error: 'Payment type is required' });
      }
      if (!paymentData.amount || paymentData.amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }
      if (!paymentData.payment_method) {
        return res.status(400).json({ error: 'Payment method is required' });
      }

      const newPayment = await MosquePayment.create(paymentData);
      res.status(201).json({
        message: 'Mosque payment created successfully',
        data: newPayment
      });
    } catch (err) {
      console.error('Create mosque payment error:', err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Transaction ID already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updatePayment: async (req, res) => {
    try {
      const id = req.params.id;
      const paymentData = req.body;

      const updatedPayment = await MosquePayment.update(id, paymentData);
      res.status(200).json({
        message: 'Mosque payment updated successfully',
        data: updatedPayment
      });
    } catch (err) {
      console.error('Update mosque payment error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  deletePayment: async (req, res) => {
    try {
      const id = req.params.id;
      await MosquePayment.delete(id);
      res.json({ message: 'Mosque payment deleted successfully' });
    } catch (err) {
      console.error('Delete mosque payment error:', err);
      res.status(500).json({ error: err.message });
    }
  },

  getStatsByType: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await MosquePayment.getStatsByType(startDate, endDate);
      res.json({ data: stats });
    } catch (err) {
      console.error('Get stats by type error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getStatsByMethod: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await MosquePayment.getStatsByMethod(startDate, endDate);
      res.json({ data: stats });
    } catch (err) {
      console.error('Get stats by method error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = MosquePaymentController;
