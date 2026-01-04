const DEFAULT_TTL_MIN = 60;

class SessionStore {
  constructor() {
    /** @type {Map<string, any>} */
    this.sessions = new Map();
  }

  _now() {
    return Date.now();
  }

  _ttlMs() {
    const ttlMin = Number(process.env.CASHMATIC_SESSION_TTL_MIN || DEFAULT_TTL_MIN);
    return ttlMin * 60 * 1000;
  }

  create(session) {
    const sessionId = session.sessionId;
    const record = {
      ...session,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(this._now() + this._ttlMs()).toISOString(),
    };
    this.sessions.set(sessionId, record);
    return record;
  }

  get(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (Date.parse(s.expiresAt) < this._now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return s;
  }

  update(sessionId, patch) {
    const current = this.get(sessionId);
    if (!current) return null;
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  cleanup() {
    const now = this._now();
    for (const [id, s] of this.sessions.entries()) {
      if (Date.parse(s.expiresAt) < now) this.sessions.delete(id);
    }
  }
}

module.exports = { SessionStore };
