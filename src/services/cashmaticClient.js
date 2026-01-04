const axios = require('axios');
const https = require('https');

function buildBaseUrl() {
  const host = process.env.CASHMATIC_HOST;
  const port = process.env.CASHMATIC_PORT || '50301';
  if (!host) throw new Error('CASHMATIC_HOST is not set');
  return `https://${host}:${port}/api`;
}

function tlsAgent() {
  const insecure = String(process.env.CASHMATIC_TLS_INSECURE || 'true').toLowerCase() === 'true';
  return new https.Agent({ rejectUnauthorized: !insecure });
}

function extractToken(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return (
    data.token ||
    data.accessToken ||
    data.access_token ||
    data.jwt ||
    (data.data && (data.data.token || data.data.accessToken)) ||
    null
  );
}

class CashmaticClient {
  constructor() {
    this.baseUrl = buildBaseUrl();
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      httpsAgent: tlsAgent(),
      headers: { 'Content-Type': 'application/json' },
    });

    this._token = null;
    this._tokenUpdatedAt = 0;
  }

  async _login() {
    const username = process.env.CASHMATIC_USERNAME || 'cashmatic';
    const password = process.env.CASHMATIC_PASSWORD || 'admin';
    const resp = await this.http.post('/user/Login', { username, password });
    const token = extractToken(resp.data);
    if (!token) throw new Error('Login succeeded but token not found in response');
    this._token = token;
    this._tokenUpdatedAt = Date.now();
    return token;
  }

  async _renewToken() {
    if (!this._token) return this._login();
    const resp = await this.http.post('/user/RenewToken', {}, { headers: { Authorization: `Bearer ${this._token}` } });
    const token = extractToken(resp.data) || this._token;
    this._token = token;
    this._tokenUpdatedAt = Date.now();
    return token;
  }

  async _authedPost(path, body) {
    if (!this._token) await this._login();
    try {
      return await this.http.post(path, body || {}, { headers: { Authorization: `Bearer ${this._token}` } });
    } catch (err) {
      // Try once with renew/login on 401
      const status = err?.response?.status;
      if (status === 401) {
        try {
          await this._renewToken();
          return await this.http.post(path, body || {}, { headers: { Authorization: `Bearer ${this._token}` } });
        } catch (e2) {
          throw e2;
        }
      }
      throw err;
    }
  }

  async startPayment({ amountCents, reference, reason = 'SALE', queueAllowed = true }) {
    return this._authedPost('/transaction/StartPayment', {
      reason,
      reference,
      amount: amountCents,
      queueAllowed: !!queueAllowed,
    });
  }

  async activeTransaction() {
    return this._authedPost('/device/ActiveTransaction', {});
  }

  async commitPayment() {
    return this._authedPost('/transaction/CommitPayment', {});
  }

  async cancelPayment() {
    return this._authedPost('/transaction/CancelPayment', {});
  }

  async lastTransaction() {
    return this._authedPost('/device/LastTransaction', {});
  }

  async getDeviceInfo() {
    // Optional health-check endpoint; if not supported, ignore in routes.
    return this._authedPost('/device/GetDeviceInfo', {});
  }
}

module.exports = { CashmaticClient };
