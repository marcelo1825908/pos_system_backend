const express = require('express');
const router = express.Router();
const MosquePaymentController = require('../mosque/controllers/MosquePaymentController');

// Mosque Payment routes
router.get('/payments', MosquePaymentController.getAllPayments);
router.get('/payments/:id', MosquePaymentController.getPaymentById);
router.get('/payments/transaction/:transactionId', MosquePaymentController.getPaymentByTransactionId);
router.get('/payments/member/:memberId', MosquePaymentController.getPaymentsByMemberId);
router.post('/payments', MosquePaymentController.createPayment);
router.put('/payments/:id', MosquePaymentController.updatePayment);
router.delete('/payments/:id', MosquePaymentController.deletePayment);
router.get('/payments/stats/by-type', MosquePaymentController.getStatsByType);
router.get('/payments/stats/by-method', MosquePaymentController.getStatsByMethod);

module.exports = router;