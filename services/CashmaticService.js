// CashmaticService.js - horeca POS integration (no kiosk)
// Uses Cashmatic 460 HTTPS API

const https = require('https');
const axios = require('axios');
const { readConfig } = require('../config/cashmaticConfig');

// In-memory sessions: sessionId -> { token, amount, state, createdAt, insertedAmount }
const sessions = new Map();

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

class CashmaticService {
  static getConfiguredIp() {
    const cfg = readConfig();
    return cfg.ip || '192.168.1.58';
  }

  static getBaseUrl() {
    const ip = this.getConfiguredIp();
    return `https://${ip}:50301`;
  }

  static getHttpClient() {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // self-signed certificate on Cashmatic
    });

    return axios.create({
      httpsAgent,
      timeout: 5000,
    });
  }

  static async login() {
    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    const cfg = readConfig();
    console.log("inside the Login ");
    try {
      const res = await client.post(`${baseUrl}/api/user/Login`, {
        username: cfg.username || 'cp',
        password: cfg.password || '1235',
      });

      const data = res.data || {};
      console.log('Cashmatic login response raw:', data);

      const token =
        data.token ||
        data.accessToken ||
        data.jwt ||
        data.bearer ||
        data.Token ||
        (data.data && (data.data.token || data.data.accessToken || data.data.jwt)) ||
        (typeof data === 'string' ? data : null);

      if (!token) {
        const keys = Object.keys(data || {});
        throw new Error(
          `No token in Cashmatic login response. Got keys: [${keys.join(', ')}]`
        );
      }

      return token;
    } catch (error) {
      // Enhance error message with connection details
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        throw new Error(`Cannot connect to Cashmatic device at ${baseUrl}. Please check if the device is powered on and connected to the network. Original error: ${error.message}`);
      } else if (error.response) {
        throw new Error(`Cashmatic login failed: ${error.response.status} ${error.response.statusText || error.message}`);
      }
      throw error;
    }
  }

  static async startPayment(amountInCents) {
    console.log("inside start Payment Amount in Cents is ", amountInCents);

    const token = await this.login();
    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    console.log("Token", token, "client : ", client, " Base Url ", baseUrl);

    const body = {
      reason: 'POS payment',
      reference: `POS-${Date.now()}`,
      amount: amountInCents,
      queueAllowed: false,
    };

    try {
      await client.post(`${baseUrl}/api/transaction/StartPayment`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      // Enhance error message for StartPayment
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        throw new Error(`Cannot connect to Cashmatic device at ${baseUrl} to start payment. Please check if the device is powered on and connected to the network. Original error: ${error.message}`);
      } else if (error.response) {
        throw new Error(`Failed to start Cashmatic payment: ${error.response.status} ${error.response.statusText || error.message}`);
      }
      throw error;
    }
    console.log("api/transcation/startPayment", body, " Base URL : ", baseUrl, " Token : ", token);
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      token,
      amount: amountInCents,
      state: 'IN_PROGRESS',
      createdAt: Date.now(),
      insertedAmount: 0,
      dispensedAmount: 0,
      notDispensedAmount: 0,
      dispensedAmountCached: false,
      notDispensedAmountCached: false,
    });
    console.log("Session Id", sessionId);
    return { sessionId };
  }

  static async getStatus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();

    try {
      const res = await client.post(
        `${baseUrl}/api/device/ActiveTransaction`,
        null,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      const body = res.data || {};
      console.log('Cashmatic ActiveTransaction raw:', JSON.stringify(body, null, 2));

      const data = body.data || body;
      
      console.log('[Cashmatic] Raw data object keys:', Object.keys(data || {}));
      console.log('[Cashmatic] Raw data values:', {
        dispensed: data.dispensed,
        notDispensed: data.notDispensed,
        dispensedAmount: data.dispensedAmount,
        notDispensedAmount: data.notDispensedAmount,
        paymentDispensed: data.paymentDispensed,
        paymentNotDispensed: data.paymentNotDispensed
      });

      // Check if ActiveTransaction returns no data or operation is IDLE
      const operation = (data.operation || body.operation || '').toString().toUpperCase();
      const hasActiveTransaction = data && Object.keys(data).length > 0 && operation !== 'IDLE';

      // If no active transaction, try LastTransaction to get final dispensed amounts
      if (!hasActiveTransaction && (session.state === 'PAID' || session.state === 'IN_PROGRESS')) {
        console.log('[Cashmatic] No active transaction found, checking LastTransaction for final amounts...');
        
        try {
          const lastTxRes = await client.post(
            `${baseUrl}/api/device/LastTransaction`,
            null,
            {
              headers: {
                Authorization: `Bearer ${session.token}`,
              },
            }
          );

          const lastTxBody = lastTxRes.data || {};
          const lastTxData = lastTxBody.data || lastTxBody;
          
          console.log('Cashmatic LastTransaction raw:', JSON.stringify(lastTxBody, null, 2));
          
          if (lastTxData && Object.keys(lastTxData).length > 0) {
            // Use LastTransaction data for final amounts
            const lastRequested = Number(lastTxData.requested) || session.amount;
            const lastInserted = Number(lastTxData.inserted) || session.insertedAmount || 0;
            let lastDispensed = Number(lastTxData.dispensed) || 0;
            let lastNotDispensed = Number(lastTxData.notDispensed) || 0;
            
            // Check denominationsDispensed array for actual dispensed amount
            if (lastDispensed === 0 && lastTxData.denominationsDispensed && Array.isArray(lastTxData.denominationsDispensed)) {
              lastDispensed = lastTxData.denominationsDispensed.reduce((total, denom) => {
                return total + (Number(denom.value) || 0);
              }, 0);
              console.log(`[Cashmatic] Calculated dispensed from denominations: ${lastDispensed}`);
            }
            
            // Recalculate notDispensed if needed
            const totalChange = lastInserted - lastRequested;
            if (totalChange > 0 && lastNotDispensed === 0 && lastDispensed < totalChange) {
              lastNotDispensed = totalChange - lastDispensed;
              console.log(`[Cashmatic] Recalculated notDispensed: ${lastNotDispensed}`);
            }
            
            console.log(`[Cashmatic] LastTransaction values: requested=${lastRequested}, inserted=${lastInserted}, dispensed=${lastDispensed}, notDispensed=${lastNotDispensed}`);
            
            // Update session with final values
            session.amount = lastRequested;
            session.insertedAmount = lastInserted;
            session.dispensedAmount = lastDispensed;
            session.notDispensedAmount = lastNotDispensed;
            
            // Determine final state
            let finalState = 'FINISHED';
            if (lastNotDispensed > 0) {
              finalState = 'FINISHED_MANUAL';
              console.log(`[Cashmatic] Manual change required: ${lastNotDispensed}`);
            } else {
              console.log('[Cashmatic] Change dispensed successfully');
            }
            
            session.state = finalState;
            sessions.set(sessionId, session);
            
            return {
              state: finalState,
              requestedAmount: lastRequested,
              insertedAmount: lastInserted,
              dispensedAmount: lastDispensed,
              notDispensedAmount: lastNotDispensed,
              rawStatus: 'COMPLETED',
            };
          }
        } catch (lastTxError) {
          console.error('Error fetching LastTransaction:', lastTxError.message);
          // Continue with ActiveTransaction logic below
        }
      }

      // No data at all: treat as end of transaction, re-use session state
      if (!data || (Object.keys(data).length === 0 && data.constructor === Object)) {
        if (session.state === 'FINISHED' || session.state === 'FINISHED_MANUAL') {
          return {
            state: session.state,
            requestedAmount: session.amount,
            insertedAmount: session.insertedAmount || session.amount,
            dispensedAmount: session.dispensedAmount || 0,
            notDispensedAmount: session.notDispensedAmount || 0,
            rawStatus: 'NO_DATA',
          };
        } else if (session.state === 'PAID') {
          return {
            state: 'PAID',
            requestedAmount: session.amount,
            insertedAmount: session.insertedAmount || session.amount,
            dispensedAmount: session.dispensedAmount || 0,
            notDispensedAmount: session.notDispensedAmount || 0,
            rawStatus: 'NO_DATA',
          };
        } else if (session.state === 'CANCELLED') {
          return {
            state: 'CANCELLED',
            requestedAmount: session.amount,
            insertedAmount: session.insertedAmount || 0,
            dispensedAmount: session.dispensedAmount || 0,
            notDispensedAmount: session.notDispensedAmount || 0,
            rawStatus: 'NO_DATA',
          };
        } else {
          session.state = 'CANCELLED';
          sessions.set(sessionId, session);
          return {
            state: 'CANCELLED',
            requestedAmount: session.amount,
            insertedAmount: session.insertedAmount || 0,
            dispensedAmount: session.dispensedAmount || 0,
            notDispensedAmount: session.notDispensedAmount || 0,
            rawStatus: 'NO_DATA',
          };
        }
      }

      // Continue with existing ActiveTransaction processing logic...
      const requestedRaw = typeof data.requested !== 'undefined' ? data.requested : session.amount;
      const insertedRaw = typeof data.inserted !== 'undefined' ? data.inserted : 0;

      let requested = Number(requestedRaw);
      let inserted = Number(insertedRaw);

      if (!Number.isFinite(requested) || requested <= 0) {
        requested = session.amount;
      }
      if (!Number.isFinite(inserted) || inserted < 0) {
        inserted = 0;
      }

      // Try multiple possible field names for dispensed amounts, checking both data and body
      const dispensedRaw = data.dispensed !== undefined ? data.dispensed : 
                          data.dispensedAmount !== undefined ? data.dispensedAmount :
                          data.paymentDispensed !== undefined ? data.paymentDispensed :
                          body.dispensed !== undefined ? body.dispensed :
                          body.dispensedAmount !== undefined ? body.dispensedAmount :
                          body.paymentDispensed !== undefined ? body.paymentDispensed : 0;
      
      const notDispensedRaw = data.notDispensed !== undefined ? data.notDispensed :
                             data.notDispensedAmount !== undefined ? data.notDispensedAmount :
                             data.paymentNotDispensed !== undefined ? data.paymentNotDispensed :
                             body.notDispensed !== undefined ? body.notDispensed :
                             body.notDispensedAmount !== undefined ? body.notDispensedAmount :
                             body.paymentNotDispensed !== undefined ? body.paymentNotDispensed : 0;

      const dispensed = Number(dispensedRaw) || 0;
      const notDispensed = Number(notDispensedRaw) || 0;

      console.log(`[Cashmatic] Raw dispensed values: dispensed=${dispensedRaw}, notDispensed=${notDispensedRaw}`);

      const rawStatus = (data.status || body.status || '').toString().toUpperCase();

      console.log(`[Cashmatic] Session ${sessionId}: operation="${operation}", status="${rawStatus}", requested=${requested}, inserted=${inserted}, dispensed=${dispensed}, notDispensed=${notDispensed}`);

      if (requested > 0) session.amount = requested;
      if (inserted > 0) session.insertedAmount = inserted;

      // CRITICAL: Cache dispensed amounts when they first appear (they may disappear later)
      if (dispensed > 0 && !session.dispensedAmountCached) {
        session.dispensedAmount = dispensed;
        session.dispensedAmountCached = true;
        console.log(`[Cashmatic] Cached dispensed amount: ${dispensed}`);
      }
      if (notDispensed > 0 && !session.notDispensedAmountCached) {
        session.notDispensedAmount = notDispensed;
        session.notDispensedAmountCached = true;
        console.log(`[Cashmatic] Cached notDispensed amount: ${notDispensed}`);
      }

      // If both amounts are 0 but we haven't cached anything yet, store them anyway
      if (!session.dispensedAmountCached && !session.notDispensedAmountCached) {
      session.dispensedAmount = dispensed;
      session.notDispensedAmount = notDispensed;
    }
      let state = session.state || 'IN_PROGRESS';
      console.log(`[Cashmatic] Current session state: ${state}`);
// Check if transaction completed (API returns empty data after completion)
      const transactionCompleted = (requested === 0 && inserted === 0 && dispensed === 0 && notDispensed === 0) && 
                                  (session.dispensedAmountCached || session.notDispensedAmountCached  || session.state === 'PAID');

      if (transactionCompleted) {
        console.log('[Cashmatic] Transaction completed - API returned empty data, using cached values');
        if (session.notDispensedAmount > 0) {
          console.log(`[Cashmatic] Manual change required: ${session.notDispensedAmount}`);
          state = 'FINISHED_MANUAL';
        } else {
          console.log('[Cashmatic] Change dispensed successfully');
          state = 'FINISHED';
        }
      } else if (operation && operation !== 'IDLE') {
        // Transaction is still running
        console.log(`[Cashmatic] Operation is active: ${operation}`);
        if (requested > 0 && inserted >= requested) {
          // Money fully inserted, waiting for change
          console.log('[Cashmatic] Payment complete, waiting for change dispensing...');
          state = 'PAID';
        } else {
          console.log('[Cashmatic] Payment in progress...');
          state = 'IN_PROGRESS';
        }
      } else {
        // Operation is IDLE => transaction finished on the device
        console.log('[Cashmatic] Operation is IDLE - transaction ending');
        if (requested > 0 && inserted >= requested) {
          // Payment was completed successfully
          console.log('[Cashmatic] Payment amount satisfied, marking as FINISHED');
          if (notDispensed > 0) {
            // Device could not dispense all change – manual change required
            console.log(`[Cashmatic] Manual change required: ${notDispensed}`);
            state = 'FINISHED_MANUAL';
          } else {
            console.log('[Cashmatic] Change dispensed successfully');
            state = 'FINISHED';
          }
        } else if (session.state === 'PAID' && inserted >= requested) {
          // Was in PAID state and money is complete, now IDLE = transaction finished
          console.log('[Cashmatic] Transitioning from PAID to FINISHED');
          if (notDispensed > 0) {
            state = 'FINISHED_MANUAL';
          } else {
            state = 'FINISHED';
          }
        } else if (
          rawStatus.includes('CANCEL') ||
          rawStatus.includes('ABORT') ||
          rawStatus.includes('STOP')
        ) {
          console.log('[Cashmatic] Transaction cancelled');
          state = 'CANCELLED';
        } else if (
          rawStatus.includes('ERROR') ||
          rawStatus.includes('FAIL')
        ) {
          console.log('[Cashmatic] Transaction error');
          state = 'ERROR';
        } else if (session.state === 'PAID') {
          // If we were in PAID state, don't revert to CANCELLED
          // Keep checking until we get proper completion
          console.log('[Cashmatic] Still in PAID state, waiting for completion...');
          state = 'PAID';
        } else {
          // Only mark as cancelled if payment wasn't completed
          if (inserted < requested) {
            console.log('[Cashmatic] Insufficient payment, marking as CANCELLED');
            state = 'CANCELLED';
          } else {
            // Payment amount was met, mark as finished
            console.log('[Cashmatic] Payment satisfied in IDLE, marking as FINISHED');
            state = notDispensed > 0 ? 'FINISHED_MANUAL' : 'FINISHED';
          }
        }
      }
// Check for timeout (if transaction has been running too long)
      const transactionAge = Date.now() - session.createdAt;
      const timeoutMs = 5 * 60 * 1000; // 5 minutes timeout

      if (transactionAge > timeoutMs && session.state !== 'FINISHED' && session.state !== 'FINISHED_MANUAL') {
        console.log(`[Cashmatic] Transaction timeout after ${transactionAge}ms`);
        if (session.insertedAmount >= session.amount) {
          // Payment was made, assume completion
          state = session.notDispensedAmount > 0 ? 'FINISHED_MANUAL' : 'FINISHED';
        } else {
          state = 'CANCELLED';
        }
      }
      console.log(`[Cashmatic] New state: ${state}`);
      session.state = state;
      sessions.set(sessionId, session);

      return {
        state,
        requestedAmount: requested || session.amount || 0,
        insertedAmount: inserted || session.insertedAmount || 0,
        dispensedAmount: session.dispensedAmount || 0,
        notDispensedAmount: session.notDispensedAmount || 0,
        rawStatus,
      };
    } catch (err) {
      console.error('Cashmatic getStatus error:', err.message || err);
      return {
        state: 'ERROR',
        requestedAmount: session.amount,
        insertedAmount: 0,
        dispensedAmount: 0,
        notDispensedAmount: 0,
        errorMessage: 'Error communicating with Cashmatic: ' + (err.message || 'Unknown error'),
      };
    }
  }
  static async finishPayment(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();

    try {
      console.log('Calling Cashmatic CommitPayment API...');
      await client.post(
        `${baseUrl}/api/transaction/CommitPayment`,
        null,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );
      
      console.log('Cashmatic CommitPayment successful');
    } catch (err) {
      console.error('Cashmatic finishPayment error:', err.message || err);
      // Don't throw - payment was successful, just log the error
    }

    // Clean up session
    sessions.delete(sessionId);

    return {
      state: 'FINISHED',
      success: true,
    };
  }

  static async cancelPayment(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();

    try {
      await client.post(
        `${baseUrl}/api/transaction/CancelPayment`,
        null,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );
    } catch (err) {
      console.error('Cashmatic cancelPayment error:', err.message || err);
    }

    session.state = 'CANCELLED';
    sessions.set(sessionId, session);

    return {
      state: 'CANCELLED',
    };
  }
}

// Instance-based service for dynamic terminal configuration
class CashmaticServiceInstance {
  constructor(config) {
    this.config = config || {};
    this.sessions = new Map();
  }

  getConfiguredIp() {
    return this.config.ip || '192.168.1.58';
  }

  getBaseUrl() {
    const ip = this.getConfiguredIp();
    return `https://${ip}:50301`;
  }

  getHttpClient() {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // self-signed certificate on Cashmatic
    });

    return axios.create({
      httpsAgent,
      timeout: 3000, // Reduced timeout to fail faster
    });
  }

  async login() {
    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();
    console.log("inside the Login with config:", { ip: this.config.ip, username: this.config.username });
    try {
      const res = await client.post(`${baseUrl}/api/user/Login`, {
        username: this.config.username || 'cp',
        password: this.config.password || '1235',
      }, {
        timeout: 3000, // Explicit timeout for this request
      });

      const data = res.data || {};
      console.log('Cashmatic login response raw:', data);

      const token =
        data.token ||
        data.accessToken ||
        data.jwt ||
        data.bearer ||
        data.Token ||
        (data.data && (data.data.token || data.data.accessToken || data.data.jwt)) ||
        (typeof data === 'string' ? data : null);

      if (!token) {
        const keys = Object.keys(data || {});
        throw new Error(
          `No token in Cashmatic login response. Got keys: [${keys.join(', ')}]`
        );
      }

      return token;
    } catch (error) {
      // Enhance error message with connection details
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.message.includes('timeout')) {
        const errorMsg = `Cannot connect to Cashmatic device at ${baseUrl}. Please check if the device is powered on and connected to the network.`;
        console.error(errorMsg, error.message);
        throw new Error(errorMsg);
      } else if (error.response) {
        throw new Error(`Cashmatic login failed: ${error.response.status} ${error.response.statusText || error.message}`);
      }
      throw error;
    }
  }

  async createSession(amountInCents) {
    console.log("inside createSession Amount in Cents is ", amountInCents);

    try {
      const token = await this.login();
      const client = this.getHttpClient();
      const baseUrl = this.getBaseUrl();
      console.log("Token", token, "client : ", client, " Base Url ", baseUrl);

      const body = {
        reason: 'POS payment',
        reference: `POS-${Date.now()}`,
        amount: amountInCents,
        queueAllowed: false,
      };

      try {
        await client.post(`${baseUrl}/api/transaction/StartPayment`, body, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 3000, // Explicit timeout for this request
        });
      } catch (error) {
        // Enhance error message for StartPayment
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.message.includes('timeout')) {
          const errorMsg = `Cannot connect to Cashmatic device at ${baseUrl} to start payment. Please check if the device is powered on and connected to the network.`;
          console.error(errorMsg, error.message);
          throw new Error(errorMsg);
        } else if (error.response) {
          throw new Error(`Failed to start Cashmatic payment: ${error.response.status} ${error.response.statusText || error.message}`);
        }
        throw error;
      }
      console.log("api/transaction/startPayment", body, " Base URL : ", baseUrl, " Token : ", token);
      const sessionId = generateSessionId();
      this.sessions.set(sessionId, {
        token,
        amount: amountInCents,
        state: 'IN_PROGRESS',
        createdAt: Date.now(),
        insertedAmount: 0,
        dispensedAmount: 0,
        notDispensedAmount: 0,
        dispensedAmountCached: false,
        notDispensedAmountCached: false,
      });
      console.log("Session Id", sessionId);
      return { success: true, sessionId };
    } catch (error) {
      console.error('Cashmatic createSession error:', error);
      return { success: false, message: error.message };
    }
  }

  async testConnection() {
    try {
      await this.login();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        state: 'ERROR',
        message: 'Session not found'
      };
    }

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();

    try {
      const res = await client.post(
        `${baseUrl}/api/device/ActiveTransaction`,
        null,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      const body = res.data || {};
      const data = body.data || body;
      const operation = (data.operation || body.operation || '').toString().toUpperCase();
      
      const requestedRaw = typeof data.requested !== 'undefined' ? data.requested : session.amount;
      const insertedRaw = typeof data.inserted !== 'undefined' ? data.inserted : 0;
      let requested = Number(requestedRaw) || session.amount;
      let inserted = Number(insertedRaw) || 0;

      const dispensed = Number(data.dispensed || data.dispensedAmount || data.paymentDispensed || 0);
      const notDispensed = Number(data.notDispensed || data.notDispensedAmount || data.paymentNotDispensed || 0);

      if (requested > 0) session.amount = requested;
      if (inserted > 0) session.insertedAmount = inserted;
      if (dispensed > 0) session.dispensedAmount = dispensed;
      if (notDispensed > 0) session.notDispensedAmount = notDispensed;

      let state = session.state || 'IN_PROGRESS';
      if (operation && operation !== 'IDLE') {
        if (requested > 0 && inserted >= requested) {
          state = 'PAID';
        } else {
          state = 'IN_PROGRESS';
        }
      } else {
        if (requested > 0 && inserted >= requested) {
          state = notDispensed > 0 ? 'FINISHED_MANUAL' : 'FINISHED';
        } else if (inserted < requested) {
          state = 'CANCELLED';
        } else {
          state = notDispensed > 0 ? 'FINISHED_MANUAL' : 'FINISHED';
        }
      }

      session.state = state;
      this.sessions.set(sessionId, session);

      return {
        success: true,
        state,
        requestedAmount: requested || session.amount || 0,
        insertedAmount: inserted || session.insertedAmount || 0,
        dispensedAmount: session.dispensedAmount || 0,
        notDispensedAmount: session.notDispensedAmount || 0,
      };
    } catch (err) {
      console.error('Cashmatic getSessionStatus error:', err.message || err);
      return {
        success: false,
        state: 'ERROR',
        requestedAmount: session.amount,
        insertedAmount: session.insertedAmount || 0,
        dispensedAmount: session.dispensedAmount || 0,
        notDispensedAmount: session.notDispensedAmount || 0,
        message: 'Error communicating with Cashmatic: ' + (err.message || 'Unknown error'),
      };
    }
  }

  async cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        state: 'ERROR',
        message: 'Session not found'
      };
    }

    const client = this.getHttpClient();
    const baseUrl = this.getBaseUrl();

    try {
      await client.post(
        `${baseUrl}/api/transaction/CancelPayment`,
        null,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );
    } catch (err) {
      console.error('Cashmatic cancelSession error:', err.message || err);
    }

    session.state = 'CANCELLED';
    this.sessions.set(sessionId, session);

    return {
      success: true,
      state: 'CANCELLED',
    };
  }
}

// Factory function to create CashmaticService instance from terminal config
function createCashmaticService(terminal) {
  if (!terminal) {
    throw new Error('Terminal configuration is required');
  }

  if (!terminal.connection_string) {
    console.warn('Terminal connection_string is missing, using defaults');
    // Use defaults if connection_string is missing
    return new CashmaticServiceInstance({
      ip: '192.168.1.58',
      username: 'cp',
      password: '1235',
    });
  }

  // Parse connection_string
  let config = {};
  try {
    const connectionString = terminal.connection_string;
    
    if (typeof connectionString === 'string') {
      try {
        config = JSON.parse(connectionString);
      } catch (e) {
        // If not JSON, try to parse TCP format
        if (connectionString && connectionString.startsWith('tcp://')) {
          const match = connectionString.match(/tcp:\/\/([^:]+):?(\d+)?/);
          if (match) {
            config = { ip: match[1], port: match[2] || '' };
          }
        } else if (connectionString.trim() !== '') {
          // If it's a non-empty string but not JSON or TCP format, try to use it as IP
          config = { ip: connectionString.trim() };
        }
      }
    } else if (connectionString && typeof connectionString === 'object') {
      config = connectionString;
    }

    // Extract fields with multiple name variations (case-insensitive)
    const getConfigValue = (...keys) => {
      for (const key of keys) {
        if (config[key] !== undefined && config[key] !== null && config[key] !== '') {
          return String(config[key]).trim();
        }
        const lowerKey = key.toLowerCase();
        for (const configKey in config) {
          if (configKey.toLowerCase() === lowerKey && config[configKey] !== undefined && config[configKey] !== null && config[configKey] !== '') {
            return String(config[configKey]).trim();
          }
        }
      }
      return '';
    };

    const serviceConfig = {
      ip: getConfigValue('ip', 'ipAddress', 'ip_address', 'IP', 'IPAddress') || '192.168.1.58',
      username: getConfigValue('username', 'userName', 'user_name', 'Username', 'USERNAME') || 'cp',
      password: getConfigValue('password', 'Password', 'PASSWORD') || '1235',
    };

    console.log('Creating CashmaticService with config:', { ...serviceConfig, password: '***' });
    return new CashmaticServiceInstance(serviceConfig);
  } catch (error) {
    console.error('Error parsing terminal connection_string:', error, 'Terminal:', terminal);
    // Return a service with defaults instead of throwing
    console.warn('Using default configuration due to parsing error');
    return new CashmaticServiceInstance({
      ip: '192.168.1.58',
      username: 'cp',
      password: '1235',
    });
  }
}

// Legacy singleton instance for backward compatibility
const cashmaticService = new CashmaticServiceInstance();

module.exports = CashmaticService;
module.exports.CashmaticServiceInstance = CashmaticServiceInstance;
module.exports.createCashmaticService = createCashmaticService;
module.exports.cashmaticService = cashmaticService;
