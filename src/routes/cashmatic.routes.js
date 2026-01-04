const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { CashmaticClient } = require('../services/cashmaticClient');
const { SessionStore } = require('../services/sessionStore');
const { eurosToCents } = require('../utils/money');

const router = express.Router();
const cashmatic = new CashmaticClient();
const store = new SessionStore();

function pollIntervalMs() {
  const v = Number(process.env.CASHMATIC_STATUS_POLL_MS || 200);
  return Number.isFinite(v) && v > 0 ? v : 200;
}

async function waitForIdle(maxMs = 60000) {
  const start = Date.now();
  const interval = pollIntervalMs();
  while (true) {
    const resp = await cashmatic.activeTransaction();
    const data = resp.data || {};
    const op = (data.operation || '').toLowerCase();
    if (op === 'idle') return data;
    if (Date.now() - start > maxMs) {
      const err = new Error('Timeout waiting for Cashmatic operation to become idle');
      err.cashmatic = data;
      throw err;
    }
    await new Promise(r => setTimeout(r, interval));
  }
}

function normalizeStatus(session, active) {
  const requested = active?.requested ?? session?.requested ?? null;
  const inserted = active?.inserted ?? 0;
  const dispensed = active?.dispensed ?? 0;

  const op = (active?.operation || '').toLowerCase();
  let state = 'IN_PROGRESS';
  if (op === 'idle') state = session?.state === 'COMPLETED' ? 'COMPLETED' : (session?.state || 'IDLE');

  const canFinish = requested !== null && inserted >= requested && state !== 'COMPLETED' && state !== 'CANCELLED';
  const canCancel = state !== 'COMPLETED' && state !== 'CANCELLED';

  return {
    sessionId: session?.sessionId,
    state,
    operation: active?.operation ?? null,
    requested,
    inserted,
    dispensed,
    notDispensed: active?.notDispensed ?? null,
    status: active?.status ?? null,
    queuePosition: active?.queuePosition ?? null,
    canFinish,
    canCancel,
    raw: active || null,
  };
}

/**
 * POST /api/cashmatic/start
 * body: { amount: number|string (EUR or cents), amountCents?: number, reference?: string, reason?: string, queueAllowed?: boolean }
 */
router.post('/start', async (req, res) => {
  try {
    store.cleanup();

    const { amount, amountCents, reference, reason, queueAllowed } = req.body || {};
    const cents =
      Number.isFinite(Number(amountCents)) ? Math.round(Number(amountCents)) :
      (Number.isFinite(Number(amount)) && Number(amount) > 50 ? Math.round(Number(amount)) : eurosToCents(amount));

    if (!Number.isFinite(cents) || cents <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Provide amount (EUR, e.g. 12.50) or amountCents (e.g. 1250).' });
    }

    const sessionId = uuidv4();
    const ref = reference || `POS-${sessionId.substring(0, 8)}`;

    // Start payment on Cashmatic
    await cashmatic.startPayment({ amountCents: cents, reference: ref, reason, queueAllowed });

    const session = store.create({
      sessionId,
      reference: ref,
      requested: cents,
      state: 'IN_PROGRESS',
    });

    return res.json({
      sessionId: session.sessionId,
      requested: session.requested,
      reference: session.reference,
      startedAt: session.createdAt,
    });
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || err?.cashmatic || null;
    return res.status(500).json({
      error: 'Failed to start Cashmatic payment',
      httpStatus: status || null,
      details,
      message: err?.message || String(err),
    });
  }
});

/**
 * GET /api/cashmatic/status/:sessionId
 */
router.get('/status/:sessionId', async (req, res) => {
  try {
    store.cleanup();
    const sessionId = req.params.sessionId;
    const session = store.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Unknown or expired sessionId' });

    // If session already finalized, return it
    if (session.state === 'COMPLETED' || session.state === 'CANCELLED') {
      return res.json(session.result || { sessionId, state: session.state });
    }

    const activeResp = await cashmatic.activeTransaction();
    const active = activeResp.data || {};

    const normalized = normalizeStatus(session, active);
    store.update(sessionId, { lastActive: active, state: normalized.state });

    return res.json(normalized);
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || err?.cashmatic || null;
    return res.status(500).json({
      error: 'Failed to fetch Cashmatic status',
      httpStatus: status || null,
      details,
      message: err?.message || String(err),
    });
  }
});

/**
 * POST /api/cashmatic/finish/:sessionId
 */
router.post('/finish/:sessionId', async (req, res) => {
  try {
    store.cleanup();
    const sessionId = req.params.sessionId;
    const session = store.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Unknown or expired sessionId' });

    if (session.state === 'COMPLETED') return res.json(session.result);

    // Commit
    await cashmatic.commitPayment();
    await waitForIdle(60000);
    const lastResp = await cashmatic.lastTransaction();
    const last = lastResp.data || {};

    const result = {
      sessionId,
      state: 'COMPLETED',
      reference: session.reference,
      requested: last.requested ?? session.requested ?? null,
      inserted: last.inserted ?? null,
      dispensed: last.dispensed ?? null,
      notDispensed: last.notDispensed ?? null,
      raw: last,
    };

    store.update(sessionId, { state: 'COMPLETED', result });

    return res.json(result);
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || err?.cashmatic || null;
    return res.status(500).json({
      error: 'Failed to finish Cashmatic payment',
      httpStatus: status || null,
      details,
      message: err?.message || String(err),
    });
  }
});

/**
 * POST /api/cashmatic/cancel/:sessionId
 */
router.post('/cancel/:sessionId', async (req, res) => {
  try {
    store.cleanup();
    const sessionId = req.params.sessionId;
    const session = store.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Unknown or expired sessionId' });

    if (session.state === 'CANCELLED') return res.json(session.result);

    await cashmatic.cancelPayment();
    await waitForIdle(60000);
    const lastResp = await cashmatic.lastTransaction();
    const last = lastResp.data || {};

    const result = {
      sessionId,
      state: 'CANCELLED',
      reference: session.reference,
      requested: last.requested ?? session.requested ?? null,
      inserted: last.inserted ?? null,
      dispensed: last.dispensed ?? null,
      notDispensed: last.notDispensed ?? null,
      refunded: last.inserted ?? null,
      raw: last,
    };

    store.update(sessionId, { state: 'CANCELLED', result });

    return res.json(result);
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || err?.cashmatic || null;
    return res.status(500).json({
      error: 'Failed to cancel Cashmatic payment',
      httpStatus: status || null,
      details,
      message: err?.message || String(err),
    });
  }
});

/**
 * GET /api/cashmatic/ping
 * Quick connectivity check (login + GetDeviceInfo if supported)
 */
router.get('/ping', async (req, res) => {
  try {
    let deviceInfo = null;
    try {
      const infoResp = await cashmatic.getDeviceInfo();
      deviceInfo = infoResp.data || null;
    } catch (e) {
      // Some firmware may not expose GetDeviceInfo; ignore.
    }
    return res.json({ ok: true, deviceInfo });
  } catch (err) {
    const status = err?.response?.status;
    const details = err?.response?.data || null;
    return res.status(500).json({
      ok: false,
      error: 'Cashmatic ping failed',
      httpStatus: status || null,
      details,
      message: err?.message || String(err),
    });
  }
});

module.exports = router;
