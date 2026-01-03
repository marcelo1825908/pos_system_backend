/**
 * PaymentService - Handles integration with Cashmatic and Bancontact payment terminals
 * 
 * This service coordinates real payment terminal integrations:
 * - Cashmatic: Cash payment machine via HTTPS REST API (port 50301)
 * - PayWorld/Vibbek: Card payment terminal via TCP/XML protocol
 */

const PaymentTerminal = require('../models/PaymentTerminal');
const net = require('net');

// Import real service implementations
const { createCashmaticService } = require('./CashmaticService');
const { createPayworldService } = require('./PayworldService');


class PaymentService {
  /**
   * Test terminal connection
   * @param {Object} terminal - Terminal configuration
   * @returns {Promise<Object>} Test result
   */
  static async testTerminalConnection(terminal) {
    try {
      console.log(`🧪 Testing connection to ${terminal.name} (${terminal.type})`);
      
      // Validate terminal configuration
      if (!terminal.connection_string) {
        return {
          success: false,
          message: 'Terminal configuration missing: connection_string is required'
        };
      }
      
      // Use real service implementations for testing with dynamic config
      if (terminal.type === 'cashmatic') {
        try {
          const service = createCashmaticService(terminal);
          return await service.testConnection();
        } catch (error) {
          // Handle configuration errors
          if (error.message.includes('configuration not set') || error.message.includes('Failed to parse')) {
            return {
              success: false,
              message: `Cashmatic configuration error: ${error.message}. Please check terminal settings.`
            };
          }
          throw error;
        }
      }
      
      if (terminal.type === 'bancontact' || terminal.type === 'payworld' || terminal.type === 'payword') {
        try {
          const service = createPayworldService(terminal);
          return await service.testConnection();
        } catch (error) {
          // Handle configuration errors
          if (error.message.includes('configuration not set') || error.message.includes('Failed to parse')) {
            return {
              success: false,
              message: `Payworld configuration error: ${error.message}. Please check terminal settings.`
            };
          }
          throw error;
        }
      }

      // Fallback to generic connection test
      if (terminal.connection_type === 'tcp') {
        return await this.testTcpConnection(terminal.connection_string);
      } else if (terminal.connection_type === 'serial') {
        return await this.testSerialConnection(terminal.connection_string);
      } else if (terminal.connection_type === 'api') {
        return await this.testApiConnection(terminal.connection_string);
      }
      
      return {
        success: false,
        message: `Unsupported terminal type: ${terminal.type}. Supported types: cashmatic, payworld, payword, bancontact`
      };
    } catch (error) {
      console.error('❌ Terminal test failed:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Connection test failed';
      
      // Network errors
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Connection refused: Terminal is not reachable at the configured address. Check if terminal is powered on and IP/port is correct.`;
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        errorMessage = `Network error: ${error.code}. Check network connectivity and terminal IP address.`;
      } else if (error.message.includes('timeout')) {
        errorMessage = `Connection timeout: Terminal did not respond. Check if terminal is online and network is working.`;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Test TCP connection
   */
  static async testTcpConnection(connectionString) {
    return new Promise((resolve) => {
      const [host, port] = connectionString.replace('tcp://', '').split(':');
      const client = new net.Socket();
      
      const timeout = setTimeout(() => {
        client.destroy();
        resolve({
          success: false,
          message: 'Connection timeout - terminal not responding'
        });
      }, 5000);
      
      client.connect(parseInt(port), host, () => {
        clearTimeout(timeout);
        client.destroy();
        resolve({
          success: true,
          message: 'Connection successful'
        });
      });
      
      client.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: `Connection failed: ${err.message}`
        });
      });
    });
  }

  /**
   * Test serial connection
   */
  static async testSerialConnection(connectionString) {
    return {
      success: false,
      message: 'Serial port testing not yet implemented. Install serialport package.'
    };
  }

  /**
   * Test API connection
   */
  static async testApiConnection(connectionString) {
    try {
      const response = await fetch(connectionString, {
        method: 'GET',
        timeout: 5000
      });
      
      return {
        success: response.ok,
        message: response.ok ? 'API connection successful' : `API returned status ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: `API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Process Cashmatic payment
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result
   */
  static async processCashmaticPayment(paymentData) {
    try {
      const { amount, member_id, payment_type, reference } = paymentData;
      
      // Amount comes in cents from frontend
      const amountInCents = Math.round(amount);
      
      console.log(`💰 Cashmatic Payment Request:`, {
        amount: `€${amountInCents / 100}`,
        amountInCents,
        member_id,
        payment_type,
        reference
      });
      
      // Get Cashmatic terminal configuration
      const terminal = await PaymentTerminal.getByType('cashmatic');
      console.log(`🔍 Cashmatic terminal lookup:`, terminal ? { id: terminal.id, name: terminal.name, enabled: terminal.enabled, type: terminal.type } : 'NOT FOUND');
      
      // If terminal is configured and enabled, use real implementation
      if (terminal && terminal.enabled) {
        console.log(`✅ Using REAL Cashmatic terminal: ${terminal.name}`);
        
        try {
          // Create service instance with terminal config
          const service = createCashmaticService(terminal);
          console.log('Created CashmaticService, attempting to create session...');
          const result = await service.createSession(amountInCents);
          
          if (result && result.success) {
            console.log('✅ Cashmatic session created successfully:', result.sessionId);
            return {
              success: true,
              transaction_id: result.sessionId,
              sessionId: result.sessionId,
              data: {
                amount: amountInCents / 100,
                method: 'cashmatic',
                status: 'in_progress',
                timestamp: new Date().toISOString(),
                reference,
                terminal: terminal.name,
                state: 'IN_PROGRESS',
                requestedAmount: amountInCents,
                insertedAmount: 0,
                dispensedAmount: 0,
                notDispensedAmount: 0
              }
            };
          } else {
            console.error('❌ Cashmatic session creation failed:', result?.message);
            return {
              success: false,
              message: result?.message || 'Failed to create Cashmatic payment session'
            };
          }
        } catch (error) {
          console.error('❌ Cashmatic payment error:', error.message);
          return {
            success: false,
            message: `Cashmatic payment failed: ${error.message}`
          };
        }
      }
      
      // No terminal configured
      console.error('❌ Cashmatic terminal not configured or not enabled');
      return {
        success: false,
        message: 'Cashmatic terminal not configured. Please configure a Cashmatic terminal in settings.'
      };
    } catch (error) {
      console.error('❌ Cashmatic payment failed:', error);
      return {
        success: false,
        message: error.message || 'Cashmatic payment failed'
      };
    }
  }

  /**
   * Get payment status (Cashmatic)
   * @param {string} transactionId - Transaction/Session ID
   * @returns {Promise<Object>} Payment status
   */
  static async getPaymentStatus(transactionId) {
    try {
      console.log(`📊 Getting payment status for: ${transactionId}`);
      
      const terminal = await PaymentTerminal.getByType('cashmatic');
      console.log(`🔍 Cashmatic terminal lookup for status:`, terminal ? { id: terminal.id, name: terminal.name, enabled: terminal.enabled, type: terminal.type } : 'NOT FOUND');
      
      if (!terminal || !terminal.enabled) {
        return {
          success: false,
          ok: false,
          message: 'Cashmatic terminal not configured or not enabled'
        };
      }
      
      try {
        // Get status from real service
        const service = createCashmaticService(terminal);
        const status = await service.getSessionStatus(transactionId);
        
        if (status && status.success) {
          console.log(`✅ Cashmatic status retrieved:`, status.state);
          return {
            success: true,
            ok: true,
            data: {
              transaction_id: transactionId,
              status: status.state === 'FINISHED' || status.state === 'FINISHED_MANUAL' ? 'completed' : 'in_progress',
              state: status.state,
              timestamp: new Date().toISOString(),
              requestedAmount: status.requestedAmount || 0,
              insertedAmount: status.insertedAmount || 0,
              dispensedAmount: status.dispensedAmount || 0,
              notDispensedAmount: status.notDispensedAmount || 0
            }
          };
        } else {
          return {
            success: false,
            ok: false,
            message: status?.message || 'Failed to get payment status'
          };
        }
      } catch (error) {
        console.error(`❌ Error getting payment status:`, error.message);
        return {
          success: false,
          ok: false,
          message: `Failed to get payment status: ${error.message}`
        };
      }
    } catch (error) {
      console.error('❌ Error getting payment status:', error);
      return {
        success: false,
        message: error.message || 'Failed to get payment status'
      };
    }
  }

  /**
   * Finish payment (Cashmatic)
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Finish result
   */
  static async finishPayment(transactionId) {
    try {
      console.log(`✅ Finishing payment: ${transactionId}`);
      
      const terminal = await PaymentTerminal.getByType('cashmatic');
      
      if (!terminal || !terminal.enabled) {
        return {
          success: false,
          message: 'Cashmatic terminal not configured or not enabled'
        };
      }
      
      try {
        const service = createCashmaticService(terminal);
        const session = service.sessions.get(transactionId);
        if (session) {
          // Real session exists, finish it
          const client = service.getHttpClient();
          const baseUrl = service.getBaseUrl();
          
          try {
            await client.post(
              `${baseUrl}/api/transaction/CommitPayment`,
              null,
              {
                headers: {
                  Authorization: `Bearer ${session.token}`,
                },
                timeout: 3000,
              }
            );
            console.log('Cashmatic CommitPayment successful');
          } catch (err) {
            console.error('Cashmatic finishPayment error:', err.message || err);
            // Don't throw - payment was successful, just log the error
          }
          
          // Clean up session
          service.sessions.delete(transactionId);
          
          return {
            success: true,
            state: 'FINISHED',
            message: 'Payment finished successfully'
          };
        } else {
          return {
            success: false,
            message: 'Payment session not found'
          };
        }
      } catch (error) {
        console.error(`❌ Error finishing payment:`, error.message);
        return {
          success: false,
          message: `Failed to finish payment: ${error.message}`
        };
      }
    } catch (error) {
      console.error('❌ Error finishing payment:', error);
      return {
        success: false,
        message: error.message || 'Failed to finish payment'
      };
    }
  }

  /**
   * Cancel payment (Cashmatic)
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelPayment(transactionId) {
    try {
      console.log(`🚫 Cancelling payment: ${transactionId}`);
      
      const terminal = await PaymentTerminal.getByType('cashmatic');
      
      if (!terminal || !terminal.enabled) {
        return {
          success: false,
          message: 'Cashmatic terminal not configured or not enabled'
        };
      }
      
      try {
        const service = createCashmaticService(terminal);
        const result = await service.cancelSession(transactionId);
        if (result && result.success) {
          return result;
        } else {
          return {
            success: false,
            message: result?.message || 'Failed to cancel payment'
          };
        }
      } catch (error) {
        console.error(`❌ Error cancelling payment:`, error.message);
        return {
          success: false,
          message: `Failed to cancel payment: ${error.message}`
        };
      }
    } catch (error) {
      console.error('❌ Error cancelling payment:', error);
      return {
        success: false,
        message: error.message || 'Failed to cancel payment'
      };
    }
  }

  /**
   * Process Bancontact payment
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result
   */
  // static async processBancontactPayment(paymentData) {
  //   return this.processPayworldPayment(paymentData);
  // }

  /**
   * Process Payworld payment
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result
   */
  // static async processPayworldPayment(paymentData) {
  //   try {
  //     const { amount, member_id, payment_type, reference } = paymentData;
      
  //     // Amount comes in euros from frontend, convert to cents
  //     const amountInCents = Math.round(amount * 100);
      
  //     console.log(`💳 Payworld Payment Request:`, {
  //       amount: `€${amount}`,
  //       amountInCents,
  //       member_id,
  //       payment_type,
  //       reference
  //     });
      
  //     // Get Bancontact/Payworld terminal configuration
  //     const terminal = PaymentTerminal.getByType('bancontact') || 
  //                      PaymentTerminal.getByType('payworld') || 
  //                      PaymentTerminal.getByType('payword');
      
  //     if (terminal && terminal.enabled) {
  //       console.log(`✅ Using REAL Payworld terminal: ${terminal.name}`);
        
  //       try {
  //         // Create service instance with terminal config
  //         const service = createPayworldService(terminal);
  //         const result = await service.createSession(amountInCents);
          
  //         if (result.success) {
  //           return {
  //             success: true,
  //             transaction_id: result.sessionId,
  //             sessionId: result.sessionId,
  //             data: {
  //               amount,
  //               method: 'payworld',
  //               status: 'in_progress',
  //               state: 'IN_PROGRESS',
  //               timestamp: new Date().toISOString(),
  //               reference,
  //               card_type: 'bancontact',
  //               terminal: terminal.name
  //             }
  //           };
  //         } else {
  //           return {
  //             success: false,
  //             message: result.message || 'Failed to start Payworld payment'
  //           };
  //         }
  //       } catch (error) {
  //         console.error('❌ Real Payworld failed:', error.message);
  //         return {
  //           success: false,
  //           message: `Payworld terminal error: ${error.message}`
  //         };
  //       }
  //     }
      
  //     // No terminal configured
  //     return {
  //       success: false,
  //       message: 'Payworld terminal not configured. Please add terminal in settings.'
  //     };
  //   } catch (error) {
  //     console.error('❌ Payworld payment failed:', error);
  //     return {
  //       success: false,
  //       message: error.message || 'Payworld payment failed'
  //     };
  //   }
  // }

  /**
   * Get Payworld payment status
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Payment status
   */
  // static async getPayworldStatus(sessionId) {
  //   try {
  //     // Get terminal to create service instance
  //     const terminal = PaymentTerminal.getByType('bancontact') || 
  //                      PaymentTerminal.getByType('payworld') || 
  //                      PaymentTerminal.getByType('payword');
      
  //     if (terminal && terminal.enabled) {
  //       const service = createPayworldService(terminal);
  //       const status = service.getSessionStatus(sessionId);
        
  //       return {
  //         success: true,
  //         ok: true,
  //         ...status
  //       };
  //     } else {
  //       return {
  //         success: false,
  //         ok: false,
  //         message: 'Payworld terminal not configured'
  //       };
  //     }
  //   } catch (error) {
  //     return {
  //       success: false,
  //       ok: false,
  //       message: error.message || 'Failed to get Payworld status'
  //     };
  //   }
  // }

  /**
   * Cancel Payworld payment
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Cancellation result
   */
  static async cancelPayworldPayment(sessionId) {
    try {
      console.log(`🚫 Cancelling Payworld payment: ${sessionId}`);

      // Get terminal to create service instance
      const terminal = PaymentTerminal.getByType('bancontact') ||
        PaymentTerminal.getByType('payworld') ||
        PaymentTerminal.getByType('payword');

      if (terminal && terminal.enabled) {
        const service = createPayworldService(terminal);
        if (typeof service.cancelSession === 'function') {
          const result = await service.cancelSession(sessionId);
          return result;
        }

        return {
          success: false,
          message: 'Payworld service does not implement cancelSession'
        };
      }

      return {
        success: false,
        message: 'Payworld terminal not configured'
      };
    } catch (error) {
      console.error('❌ cancelPayworldPayment error:', error);
      return {
        success: false,
        message: error.message || 'Failed to cancel Payworld payment'
      };
    }
  }

  /**
   * Process TCP payment (generic)
   */
  static async processTcpPayment(terminal, paymentData, method) {
    return new Promise((resolve) => {
      const [host, port] = terminal.connection_string.replace('tcp://', '').split(':');
      const client = new net.Socket();
      
      const timeout = setTimeout(() => {
        client.destroy();
        resolve({
          success: false,
          message: 'Payment timeout - terminal not responding'
        });
      }, 30000);
      
      client.connect(parseInt(port), host, () => {
        const command = JSON.stringify({
          action: 'payment',
          amount: paymentData.amount,
          reference: paymentData.reference
        });
        client.write(command + '\n');
      });
      
      client.on('data', (data) => {
        clearTimeout(timeout);
        client.destroy();
        
        try {
          const response = JSON.parse(data.toString());
          resolve({
            success: response.status === 'approved',
            transaction_id: response.transaction_id || `${method.toUpperCase()}-${Date.now()}`,
            data: response
          });
        } catch (error) {
          resolve({
            success: false,
            message: 'Invalid response from terminal'
          });
        }
      });
      
      client.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: `Terminal connection failed: ${err.message}`
        });
      });
    });
  }

  /**
   * Process serial payment (not implemented)
   */
  static async processSerialPayment(terminal, paymentData, method) {
    return {
      success: false,
      message: 'Serial port payment not yet implemented'
    };
  }

  /**
   * Process API payment (generic)
   */
  static async processApiPayment(terminal, paymentData, method) {
    try {
      const response = await fetch(terminal.connection_string + '/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
        timeout: 30000
      });
      
      const result = await response.json();
      
      return {
        success: result.status === 'approved',
        transaction_id: result.transaction_id,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: `API payment failed: ${error.message}`
      };
    }
  }
}

module.exports = PaymentService;
