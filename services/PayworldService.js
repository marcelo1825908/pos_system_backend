/**
 * PayworldService - Real implementation for PayWorld/Vibbek bank terminal
 * 
 * Based on Vibbek Till Interface v2.33 documentation:
 * - TCP socket connection
 * - XML message protocol
 * - 4-byte ASCII length prefix
 */

const net = require('net');

// Store active sessions per instance
const activeSessions = new Map();

/**
 * Translate error messages from other languages to simple English
 * @param {string} message - Error message that may be in another language
 * @returns {string} Translated error message in simple English
 */
function translateErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return message || 'Transaction error';
  }

  const msg = message.toLowerCase().trim();

  // Dutch translations
  const dutchTranslations = {
    'geweigerd': 'Payment declined',
    'geannuleerd': 'Payment cancelled',
    'fout': 'Error',
    'betaling': 'payment',
    'transactie': 'transaction',
    'verbinding': 'connection',
    'mislukt': 'failed',
    'niet beschikbaar': 'not available',
    'time-out': 'timeout',
    'ongeldig': 'invalid',
    'afgebroken': 'cancelled',
    'weigeren': 'declined',
    'annuleren': 'cancel',
    'opgehaald': 'retrieved',
    'status': 'status',
    'gestart': 'started',
    'voltooid': 'completed',
    'verbinding maken': 'connecting',
    'instructies': 'instructions',
    'terminal': 'terminal',
    'wordt geannuleerd': 'being cancelled',
    'geannuleerd op de terminal': 'cancelled on terminal',
    'annuleren op terminal mislukt': 'failed to cancel on terminal',
    'geen actieve sessie': 'no active session',
    'om te annuleren': 'to cancel',
    'geen sessionid ontvangen': 'no session id received',
    'van server': 'from server',
    'tot stand gebracht': 'established',
    'volg de instructies': 'follow the instructions',
  };

  // French translations
  const frenchTranslations = {
    'refusé': 'Payment declined',
    'annulé': 'Payment cancelled',
    'erreur': 'Error',
    'paiement': 'payment',
    'transaction': 'transaction',
    'connexion': 'connection',
    'échoué': 'failed',
    'indisponible': 'not available',
    'délai d\'attente': 'timeout',
    'invalide': 'invalid',
    'interrompu': 'cancelled',
  };

  // German translations
  const germanTranslations = {
    'abgelehnt': 'Payment declined',
    'storniert': 'Payment cancelled',
    'fehler': 'Error',
    'zahlung': 'payment',
    'transaktion': 'transaction',
    'verbindung': 'connection',
    'fehlgeschlagen': 'failed',
    'nicht verfügbar': 'not available',
    'zeitüberschreitung': 'timeout',
    'ungültig': 'invalid',
    'abgebrochen': 'cancelled',
  };

  // Check for common error patterns and translate
  for (const [dutch, english] of Object.entries(dutchTranslations)) {
    if (msg.includes(dutch)) {
      // Replace the Dutch word with English, preserving context
      return message.replace(new RegExp(dutch, 'gi'), english);
    }
  }

  for (const [french, english] of Object.entries(frenchTranslations)) {
    if (msg.includes(french)) {
      return message.replace(new RegExp(french, 'gi'), english);
    }
  }

  for (const [german, english] of Object.entries(germanTranslations)) {
    if (msg.includes(german)) {
      return message.replace(new RegExp(german, 'gi'), english);
    }
  }

  // Common error patterns
  if (msg.includes('betaling geweigerd') || msg.includes('payment declined') || msg.includes('paiement refusé') || msg.includes('zahlung abgelehnt')) {
    return 'Payment declined';
  }
  if (msg.includes('betaling geannuleerd') || msg.includes('payment cancelled') || msg.includes('paiement annulé') || msg.includes('zahlung storniert')) {
    return 'Payment cancelled';
  }
  if (msg.includes('fout tijdens') || msg.includes('error during') || msg.includes('erreur pendant') || msg.includes('fehler während')) {
    return 'Error during payment';
  }
  if (msg.includes('fout bij') || msg.includes('error retrieving') || msg.includes('erreur lors de') || msg.includes('fehler beim')) {
    return 'Error retrieving status';
  }
  if (msg.includes('verbinding') && msg.includes('mislukt')) {
    return 'Connection failed';
  }
  if (msg.includes('timeout') || msg.includes('délai') || msg.includes('zeitüberschreitung')) {
    return 'Connection timeout';
  }

  // If no translation found, return original message
  return message;
}

class PayworldService {
  constructor(config = null) {
    this.config = config;
    this.socket = null;
    this.transactionSyncCounter = 1;
  }

  /**
   * Set configuration from terminal database record
   * @param {Object} terminal - Terminal record from database
   */
  setConfig(terminal) {
    if (!terminal || !terminal.connection_string) {
      throw new Error('Terminal configuration is required');
    }
    
    try {
      // Parse connection_string JSON stored in database
      const config = typeof terminal.connection_string === 'string' 
        ? JSON.parse(terminal.connection_string)
        : terminal.connection_string;
      
      // Validate required fields
      if (!config.ip || !config.port || !config.posId) {
        throw new Error('Invalid Payworld configuration: missing ip, port, or posId');
      }
      
      this.config = {
        ip: config.ip,
        port: parseInt(config.port, 10),
        posId: config.posId,
        currencyCode: config.currencyCode || '978', // Default to EUR
      };
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to parse Payworld configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration
   */
  getConfig() {
    if (!this.config) {
      throw new Error('Payworld configuration not set. Call setConfig() first or pass config to constructor.');
    }
    return this.config;
  }

  /**
   * Generate XML message for financial transaction
   * @param {number} amount - Amount in cents
   * @param {string} transactionType - Transaction type (Purchase, Refund, etc.)
   * @param {string} reference - Transaction reference
   * @returns {string} XML message
   */
  generateFinancialTrxXml(amount, transactionType = 'Purchase', reference = '') {
    const config = this.getConfig();
    const syncNumber = this.transactionSyncCounter++;
    
    // Amount should be in minor units (cents)
    const amountStr = amount.toString().padStart(12, '0');
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<vcs-pos:financialTrxRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
    <posId>${config.posId}</posId>
    <transactionType>${transactionType}</transactionType>
    <currencyCode>${config.currencyCode}</currencyCode>
    <amount>${amountStr}</amount>
    <transactionSyncNumber>${syncNumber}</transactionSyncNumber>
    ${reference ? `<reference>${reference}</reference>` : ''}
</vcs-pos:financialTrxRequest>`;

    return xml;
  }

  /**
   * Generate XML for cancellation/abort
   * @returns {string} XML message
   */
  generateAbortXml() {
    const config = this.getConfig();
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<vcs-pos:abortCardEntryNotification xmlns:vcs-pos="http://www.vibbek.com/pos">
    <posId>${config.posId}</posId>
    <abortCode>0</abortCode>
</vcs-pos:abortCardEntryNotification>`;

    return xml;
  }

  /**
   * Generate SiInit XML for initialization
   * @returns {string} XML message
   */
  generateSiInitXml() {
    const config = this.getConfig();
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<vcs-pos:siInitRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
    <posId>${config.posId}</posId>
</vcs-pos:siInitRequest>`;

    return xml;
  }

  /**
   * Generate Ping XML
   * @returns {string} XML message
   */
  generatePingXml() {
    const config = this.getConfig();
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<vcs-pos:pingRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
    <posId>${config.posId}</posId>
</vcs-pos:pingRequest>`;

    return xml;
  }

  /**
   * Pack XML message with 4-byte ASCII length prefix
   * @param {string} xml - XML message
   * @returns {Buffer} Packed message
   */
  packMessage(xml) {
    const xmlBuffer = Buffer.from(xml, 'utf8');
    const length = xmlBuffer.length;
    const lengthStr = length.toString().padStart(4, '0');
    const lengthBuffer = Buffer.from(lengthStr, 'ascii');
    return Buffer.concat([lengthBuffer, xmlBuffer]);
  }

  /**
   * Parse response XML
   * @param {string} xml - Response XML
   * @returns {object} Parsed response
   */
  parseResponse(xml) {
    const result = {
      type: null,
      success: false,
      message: '',
      details: {},
    };

    try {
      // Extract message type
      const typeMatch = xml.match(/<vcs-(?:pos|device):(\w+)/);
      if (typeMatch) {
        result.type = typeMatch[1];
      }

      // Check for financial transaction response
      if (xml.includes('financialTrxResponse')) {
        result.type = 'financialTrxResponse';
        
        // Extract result
        const resultMatch = xml.match(/<result>(\d+)<\/result>/);
        if (resultMatch) {
          result.details.resultCode = resultMatch[1];
          result.success = resultMatch[1] === '0' || resultMatch[1] === '00';
        }

        // Extract approval code
        const approvalMatch = xml.match(/<approvalCode>([^<]+)<\/approvalCode>/);
        if (approvalMatch) {
          result.details.approvalCode = approvalMatch[1];
        }

        // Extract transaction ID
        const trxIdMatch = xml.match(/<transactionId>([^<]+)<\/transactionId>/);
        if (trxIdMatch) {
          result.details.transactionId = trxIdMatch[1];
        }

        // Extract card type
        const cardTypeMatch = xml.match(/<cardType>([^<]+)<\/cardType>/);
        if (cardTypeMatch) {
          result.details.cardType = cardTypeMatch[1];
        }

        // Extract masked PAN
        const panMatch = xml.match(/<maskedPan>([^<]+)<\/maskedPan>/);
        if (panMatch) {
          result.details.maskedPan = panMatch[1];
        }

        // Extract receipt data
        const merchantReceiptMatch = xml.match(/<merchantReceipt>([^<]+)<\/merchantReceipt>/);
        if (merchantReceiptMatch) {
          result.details.merchantReceipt = merchantReceiptMatch[1];
        }

        const cardholderReceiptMatch = xml.match(/<cardholderReceipt>([^<]+)<\/cardholderReceipt>/);
        if (cardholderReceiptMatch) {
          result.details.cardholderReceipt = cardholderReceiptMatch[1];
        }
      }

      // Check for display notification
      if (xml.includes('displayNotification')) {
        result.type = 'displayNotification';
        const textMatch = xml.match(/<text>([^<]*)<\/text>/);
        if (textMatch) {
          // Translate display notification messages to simple English
          result.message = translateErrorMessage(textMatch[1]);
        }
      }

      // Check for error notification
      if (xml.includes('errorNotification')) {
        result.type = 'errorNotification';
        result.success = false;
        
        const errorCodeMatch = xml.match(/<errorCode>([^<]+)<\/errorCode>/);
        if (errorCodeMatch) {
          result.details.errorCode = errorCodeMatch[1];
        }
        
        const errorTextMatch = xml.match(/<errorText>([^<]+)<\/errorText>/);
        if (errorTextMatch) {
          // Translate error message to simple English
          result.message = translateErrorMessage(errorTextMatch[1]);
        }
      }

      // Check for confirmation
      if (xml.includes('confirmationResponse')) {
        result.type = 'confirmationResponse';
        result.success = true;
      }

      // Check for ping response
      if (xml.includes('pingResponse')) {
        result.type = 'pingResponse';
        result.success = true;
      }

    } catch (error) {
      console.error('Error parsing Payworld response:', error);
      result.message = 'Failed to parse response';
    }

    return result;
  }

  /**
   * Send message and wait for response
   * @param {string} xml - XML message to send
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<object>} Parsed response
   */
  sendMessage(xml, timeout = 60000) {
    const config = this.getConfig();
    
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let responseBuffer = Buffer.alloc(0);
      let expectedLength = 0;
      let responses = [];

      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error('Payworld timeout - terminal not responding'));
      }, timeout);

      socket.connect(config.port, config.ip, () => {
        console.log(`📡 Connected to Payworld terminal at ${config.ip}:${config.port}`);
        
        const message = this.packMessage(xml);
        console.log(`📤 Sending: ${xml.substring(0, 200)}...`);
        socket.write(message);
      });

      socket.on('data', (data) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);

        // Process all complete messages in buffer
        while (responseBuffer.length >= 4) {
          if (expectedLength === 0) {
            const lengthStr = responseBuffer.slice(0, 4).toString('ascii');
            expectedLength = parseInt(lengthStr, 10);
          }

          if (responseBuffer.length >= 4 + expectedLength) {
            const xmlData = responseBuffer.slice(4, 4 + expectedLength).toString('utf8');
            console.log(`📥 Received: ${xmlData.substring(0, 200)}...`);
            
            const parsed = this.parseResponse(xmlData);
            responses.push(parsed);

            // Check if this is a final response
            if (parsed.type === 'financialTrxResponse' || 
                parsed.type === 'errorNotification' ||
                parsed.type === 'pingResponse') {
              clearTimeout(timeoutId);
              socket.end();
              resolve(responses.length === 1 ? responses[0] : { responses, final: parsed });
              return;
            }

            // Remove processed message from buffer
            responseBuffer = responseBuffer.slice(4 + expectedLength);
            expectedLength = 0;
          } else {
            break;
          }
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error(`❌ Payworld socket error:`, err.message);
        reject(err);
      });

      socket.on('close', () => {
        clearTimeout(timeoutId);
        if (responses.length > 0) {
          const final = responses[responses.length - 1];
          resolve(responses.length === 1 ? responses[0] : { responses, final });
        }
      });
    });
  }

  /**
   * Test connection to Payworld terminal
   * @returns {Promise<object>} Test result
   */
  async testConnection() {
    try {
      console.log(`🧪 Testing Payworld connection...`);
      
      const pingXml = this.generatePingXml();
      const response = await this.sendMessage(pingXml, 10000);
      
      if (response.type === 'pingResponse' || response.success) {
        return {
          success: true,
          message: 'Payworld terminal connection successful',
        };
      } else {
        return {
          success: false,
          message: response.message || 'Ping failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Payworld connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Initialize terminal
   * @returns {Promise<object>} Init result
   */
  async initialize() {
    try {
      const initXml = this.generateSiInitXml();
      const response = await this.sendMessage(initXml, 30000);
      return response;
    } catch (error) {
      throw new Error(`Terminal initialization failed: ${error.message}`);
    }
  }

  /**
   * Start a payment transaction
   * @param {number} amountInCents - Amount in cents
   * @param {string} reference - Transaction reference
   * @returns {Promise<object>} Transaction result
   */
  async startPayment(amountInCents, reference = '') {
    const config = this.getConfig();
    
    console.log(`💳 Starting Payworld payment: ${amountInCents} cents`);

    const trxXml = this.generateFinancialTrxXml(amountInCents, 'Purchase', reference);
    const response = await this.sendMessage(trxXml, 120000); // 2 min timeout for card payment

    return response;
  }

  /**
   * Process a refund
   * @param {number} amountInCents - Amount in cents
   * @param {string} reference - Original transaction reference
   * @returns {Promise<object>} Refund result
   */
  async processRefund(amountInCents, reference = '') {
    console.log(`💳 Processing Payworld refund: ${amountInCents} cents`);

    const trxXml = this.generateFinancialTrxXml(amountInCents, 'Refund', reference);
    const response = await this.sendMessage(trxXml, 120000);

    return response;
  }

  /**
   * Abort current transaction
   * @returns {Promise<object>} Abort result
   */
  async abortTransaction() {
    console.log(`🚫 Aborting Payworld transaction...`);

    const abortXml = this.generateAbortXml();
    const response = await this.sendMessage(abortXml, 30000);

    return response;
  }

  // ==================== Session Management ====================

  /**
   * Create a new payment session
   * @param {number} amountInCents - Amount in cents
   * @returns {Promise<object>} Session info
   */
  async createSession(amountInCents) {
    const sessionId = `PAYWORLD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session info with instance reference
    const sessionKey = `${this.config?.ip || 'default'}-${sessionId}`;
    const session = {
      id: sessionId,
      amount: amountInCents,
      state: 'IN_PROGRESS',
      message: 'Starting payment...',
      startTime: new Date().toISOString(),
      details: null,
      completed: false,
      instance: this,
    };

    activeSessions.set(sessionKey, session);

    // Start payment asynchronously
    this.processPaymentAsync(sessionKey, sessionId, amountInCents);

    return {
      success: true,
      sessionId,
      data: session,
    };
  }

  /**
   * Process payment asynchronously and update session
   * @param {string} sessionKey - Session key (with instance identifier)
   * @param {string} sessionId - Session ID
   * @param {number} amountInCents - Amount in cents
   */
  async processPaymentAsync(sessionKey, sessionId, amountInCents) {
    const session = activeSessions.get(sessionKey);
    if (!session) return;

    try {
      session.message = 'Connecting to terminal...';
      session.state = 'IN_PROGRESS';

      const response = await this.startPayment(amountInCents, sessionId);

      // Handle response
      if (response.final) {
        // Multiple messages received
        const finalResponse = response.final;
        session.details = finalResponse.details;
        
        if (finalResponse.success) {
          session.state = 'APPROVED';
          session.message = 'Payment approved';
        } else if (finalResponse.type === 'errorNotification') {
          session.state = 'ERROR';
          session.message = translateErrorMessage(finalResponse.message) || 'Transaction error';
        } else {
          session.state = 'DECLINED';
          session.message = finalResponse.message || 'Transaction declined';
        }
      } else {
        // Single response
        session.details = response.details;
        
        if (response.success) {
          session.state = 'APPROVED';
          session.message = 'Payment approved';
        } else if (response.type === 'errorNotification') {
          session.state = 'ERROR';
          session.message = translateErrorMessage(response.message) || 'Transaction error';
        } else {
          session.state = 'DECLINED';
          session.message = response.message || 'Transaction declined';
        }
      }

      session.completed = true;
    } catch (error) {
      console.error(`❌ Payworld payment error:`, error.message);
      session.state = 'ERROR';
      session.message = translateErrorMessage(error.message);
      session.completed = true;
    }

    // Clean up session after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionKey);
    }, 300000);
  }

  /**
   * Get session status
   * @param {string} sessionId - Session ID
   * @returns {object} Session status
   */
  getSessionStatus(sessionId) {
    // Find session by ID (search through all sessions)
    let session = null;
    for (const [key, value] of activeSessions.entries()) {
      if (value.id === sessionId) {
        session = value;
        break;
      }
    }
    
    if (!session) {
      return {
        success: false,
        ok: false,
        message: 'Session not found',
      };
    }

    return {
      success: true,
      ok: true,
      sessionId,
      state: session.state,
      message: session.message,
      details: session.details ? {
        amount: session.amount / 100,
        ...session.details,
      } : null,
    };
  }

  /**
   * Cancel a payment session
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Cancellation result
   */
  async cancelSession(sessionId) {
    // Find session by ID
    let session = null;
    let sessionKey = null;
    for (const [key, value] of activeSessions.entries()) {
      if (value.id === sessionId) {
        session = value;
        sessionKey = key;
        break;
      }
    }
    
    if (!session) {
      return {
        success: false,
        message: 'Session not found',
      };
    }

    if (session.completed) {
      return {
        success: false,
        message: 'Transaction already completed',
      };
    }

    try {
      await this.abortTransaction();
      
      session.state = 'CANCELLED';
      session.message = 'Payment cancelled';
      session.completed = true;
      
      return {
        success: true,
        message: 'Payment cancelled',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

// Export class and factory function
// Note: Services should be created per terminal configuration
// Use createService(terminal) to get a configured instance
function createPayworldService(terminal) {
  const service = new PayworldService();
  if (terminal) {
    service.setConfig(terminal);
  }
  return service;
}

// Legacy singleton for backward compatibility (will need config set before use)
const payworldService = new PayworldService();

module.exports = {
  PayworldService,
  payworldService,
  createPayworldService,
};

