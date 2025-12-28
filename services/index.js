/**
 * Centralized Services Export
 * 
 * Import all services from here for consistency:
 * const { PaymentService, cashmaticService, payworldService } = require('./services');
 */

const PaymentService = require('./PaymentService');
const EmailService = require('./EmailService');
const PrinterService = require('./PrinterService');
const { CashmaticService, cashmaticService, createCashmaticService } = require('./CashmaticService');
const { PayworldService, payworldService, createPayworldService } = require('./PayworldService');

module.exports = {
  // Main orchestrator
  PaymentService,
  
  // Individual terminal services
  CashmaticService,
  cashmaticService,
  createCashmaticService,
  PayworldService,
  payworldService,
  createPayworldService,
  
  // Other services
  EmailService,
  PrinterService,
};

