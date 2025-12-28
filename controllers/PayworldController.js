const path = require("path");
const fs = require("fs");
const net = require("net");

/**
 * PayworldController (session-based)
 *
 * - POST /payworld/start          -> returns sessionId immediately, starts terminal transaction async
 * - GET  /payworld/status/:id     -> returns state/message/details
 * - POST /payworld/cancel/:id     -> sends abort (same socket if still open, plus fallback)
 * - GET/POST /payworld/config     -> read/write payworld.config.json
 *
 * Protocol:
 * - TCP/IP terminal (PAX A35 / Payworld)
 * - 4-byte binary length prefix (UInt32BE) + UTF-8 XML payload
 */
class PayworldController {
  // In-memory sessions
  static sessions = new Map();
  static trxSyncNumber = 1;

  // ----------------------------
  // CONFIG
  // ----------------------------
  static getConfigPath() {
    return path.join(__dirname, "..", "config", "payworld.config.json");
  }

  static loadConfig() {
    try {
      const p = PayworldController.getConfigPath();
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      console.error("[Payworld] loadConfig failed:", e);
      return null;
    }
  }

  static saveConfig(cfg) {
    const p = PayworldController.getConfigPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
  }

  static getConfigHandler(req, res) {
    return res.json({ ok: true, config: PayworldController.loadConfig() || {} });
  }

  static updateConfigHandler(req, res) {
    try {
      const cfg = req.body || {};
      PayworldController.saveConfig(cfg);
      return res.json({ ok: true, message: "Payworld config saved.", config: cfg });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || "Failed to save config" });
    }
  }

  // ----------------------------
  // SESSION HELPERS
  // ----------------------------
  static createSession({ amountCents }) {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const session = {
      id,
      amountCents,
      state: "IN_PROGRESS", // IN_PROGRESS | APPROVED | DECLINED | CANCELLED | ERROR
      message: "Betaling gestart...",
      lastEvent: "START",
      lastUpdate: Date.now(),
      trxSyncNumber: null,
      details: null,
      // live socket refs
      socket: null,
      buffer: Buffer.alloc(0),
      resolved: false,
      cancelRequested: false,
    };
    PayworldController.sessions.set(id, session);
    return session;
  }

  static updateSession(id, patch) {
    const s = PayworldController.sessions.get(id);
    if (!s) return;
    Object.assign(s, patch);
    s.lastUpdate = Date.now();
  }

  static packFrame(xml) {
    const xmlBytes = Buffer.from(xml, "utf8");
    const lenHeader = Buffer.alloc(4);
    lenHeader.writeUInt32BE(xmlBytes.length, 0);
    return Buffer.concat([lenHeader, xmlBytes]);
  }

  // ----------------------------
  // API: START / STATUS / CANCEL
  // ----------------------------
  static async startPayment(req, res) {
    const { amount } = req.body || {};
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid amount for Payworld" });
    }

    const config = PayworldController.loadConfig();
    if (!config || !config.ip || !config.port) {
      return res.status(500).json({
        ok: false,
        error: "Payworld config ontbreekt. Vul IP en poort in (payworld.config.json).",
      });
    }

    const amountCents = Math.round(Number(amount) * 100);
    const session = PayworldController.createSession({ amountCents });

    // Start async processing
    setImmediate(() => {
      PayworldController.processSession({
        sessionId: session.id,
        ip: config.ip,
        port: Number(config.port),
        posId: config.posId || "2001",
        currencyCode: config.currencyCode || "978",
        timeoutMs: config.timeoutMs || 60000,
      }).catch((e) => {
        console.error("[Payworld] processSession fatal:", e);
        PayworldController.updateSession(session.id, {
          state: "ERROR",
          message: e.message || "Onbekende fout",
          lastEvent: "ERROR",
          details: { error: e.message },
        });
      });
    });

    // Return session id for polling
    return res.json({
      ok: true,
      provider: "payworld",
      sessionId: session.id,
      amountInCents: amountCents,
      state: session.state,
      message: session.message,
    });
  }

  static async getStatus(req, res) {
    const { sessionId } = req.params || {};
    if (!sessionId) return res.status(400).json({ ok: false, error: "Geen sessionId opgegeven." });

    const s = PayworldController.sessions.get(sessionId);
    if (!s) return res.status(404).json({ ok: false, error: "Session niet gevonden." });

    return res.json({
      ok: true,
      provider: "payworld",
      sessionId: s.id,
      amountInCents: s.amountCents,
      state: s.state,
      message: s.message,
      lastEvent: s.lastEvent,
      lastUpdate: s.lastUpdate,
      trxSyncNumber: s.trxSyncNumber,
      details: s.details,
      cancelRequested: s.cancelRequested,
    });
  }

  static async cancelPayment(req, res) {
    const { sessionId } = req.params || {};
    if (!sessionId) return res.status(400).json({ ok: false, error: "Geen sessionId opgegeven." });

    const s = PayworldController.sessions.get(sessionId);
    if (!s) return res.status(404).json({ ok: false, error: "Session niet gevonden." });

    s.cancelRequested = true;
    PayworldController.updateSession(sessionId, {
      state: "CANCELLED",
      message: "Annuleren aangevraagd...",
      lastEvent: "CANCEL_REQUESTED",
    });

    // 1) Best effort: same socket abort
    let sameSocket = false;
    try {
      if (s.socket && !s.socket.destroyed) {
        s.socket.write(PayworldController.packFrame(PayworldController.generateAbortXml()));
        sameSocket = true;
        console.log("[Payworld] Cancel: abort sent on SAME socket.");
      }
    } catch (e) {
      console.warn("[Payworld] Cancel: same-socket abort failed:", e.message);
    }

    // 2) Fallback: new socket abort
    try {
      const config = PayworldController.loadConfig();
      if (config?.ip && config?.port) {
        await PayworldController.sendAbortStandalone({ ip: config.ip, port: Number(config.port) });
        console.log("[Payworld] Cancel: abort sent via standalone socket (fallback).");
      }
    } catch (e) {
      console.warn("[Payworld] Cancel: standalone abort failed:", e.message);
    }

    return res.json({
      ok: true,
      message: sameSocket ? "Cancel verstuurd (zelfde sessie-socket)." : "Cancel verstuurd (fallback).",
    });
  }

  // ----------------------------
  // CORE: PROCESS SESSION
  // ----------------------------
  static async processSession({ sessionId, ip, port, posId, currencyCode, timeoutMs }) {
    const s = PayworldController.sessions.get(sessionId);
    if (!s) throw new Error("Session not found");

    PayworldController.updateSession(sessionId, {
      state: "IN_PROGRESS",
      message: "Verbinding met terminal wordt opgebouwd...",
      lastEvent: "CONNECTING",
    });

    const client = new net.Socket();
    s.socket = client;
    s.buffer = Buffer.alloc(0);
    s.resolved = false;

    // sync number
    PayworldController.trxSyncNumber = (PayworldController.trxSyncNumber + 1) % 1000000 || 1;
    s.trxSyncNumber = PayworldController.trxSyncNumber;

    const trxXml = PayworldController.generateFinancialTrxXml({
      posId,
      syncNumber: s.trxSyncNumber,
      amountCents: s.amountCents,
      currencyCode,
    });

    client.setTimeout(timeoutMs);

    await new Promise((resolve, reject) => {
      client.connect(port, ip, () => {
        console.log(`[Payworld] Connected to ${ip}:${port} (session ${sessionId})`);
        PayworldController.updateSession(sessionId, {
          message: "Verbonden. Wachten op kaart...",
          lastEvent: "CONNECTED",
        });
        client.write(PayworldController.packFrame(trxXml));
        resolve();
      });

      client.on("error", (err) => reject(err));
      client.on("timeout", () => reject(new Error("Timeout waiting for Payworld response")));
    });

    await new Promise((resolve, reject) => {
      const processBuffer = () => {
        while (s.buffer.length >= 4) {
          const msgLen = s.buffer.readUInt32BE(0);
          if (msgLen <= 0 || msgLen > 10 * 1024 * 1024) {
            s.resolved = true;
            client.destroy();
            reject(new Error(`Invalid Payworld frame length: ${msgLen}`));
            return;
          }
          if (s.buffer.length < 4 + msgLen) return;

          const xmlBytes = s.buffer.slice(4, 4 + msgLen);
          s.buffer = s.buffer.slice(4 + msgLen);
          const xmlString = xmlBytes.toString("utf8");

          console.log("[Payworld] Received frame XML:", xmlString);

          // Abort notification
          if (xmlString.includes("trxAbortNotification")) {
            PayworldController.updateSession(sessionId, {
              state: "CANCELLED",
              message: "Transactie geannuleerd op terminal.",
              lastEvent: "TRX_ABORT_NOTIFICATION",
              details: { rawXml: xmlString },
            });
            s.resolved = true;
            client.destroy();
            resolve();
            return;
          }

          // Final response
          const isFinancial =
            xmlString.includes("financialTrxResponse") ||
            xmlString.includes("<vcs-pos:financialTrxResponse");

          if (!isFinancial) {
            if (!s.cancelRequested) {
              PayworldController.updateSession(sessionId, {
                state: "IN_PROGRESS",
                message: "Terminal bezig...",
                lastEvent: "NOTIFICATION",
              });
            }
            continue;
          }

          const parsed = PayworldController.parseFinancialTrxResponse(xmlString);

          if (s.cancelRequested) {
            PayworldController.updateSession(sessionId, {
              state: "CANCELLED",
              message: "Annuleren bevestigd (UI). Terminal response ontvangen.",
              lastEvent: "CANCELLED_FINAL",
              details: parsed,
            });
          } else {
            PayworldController.updateSession(sessionId, {
              state: parsed.approved ? "APPROVED" : "DECLINED",
              message: parsed.approved ? "Transactie goedgekeurd." : (parsed.error || "Transactie geweigerd."),
              lastEvent: parsed.approved ? "APPROVED" : "DECLINED",
              details: parsed,
            });
          }

          s.resolved = true;
          client.destroy();
          resolve();
          return;
        }
      };

      client.on("data", (chunk) => {
        s.buffer = Buffer.concat([s.buffer, chunk]);
        processBuffer();
      });

      client.on("error", (err) => {
        PayworldController.updateSession(sessionId, {
          state: "ERROR",
          message: err.message || "Socket error",
          lastEvent: "ERROR",
        });
        if (!s.resolved) {
          s.resolved = true;
          reject(err);
        }
      });

      client.on("timeout", () => {
        PayworldController.updateSession(sessionId, {
          state: "ERROR",
          message: "Timeout op terminal.",
          lastEvent: "TIMEOUT",
        });
        s.resolved = true;
        client.destroy();
        resolve();
      });

      client.on("close", () => {
        if (!s.resolved) {
          PayworldController.updateSession(sessionId, {
            state: s.cancelRequested ? "CANCELLED" : "ERROR",
            message: s.cancelRequested
              ? "Verbinding gesloten na cancel."
              : "Verbinding gesloten zonder final response.",
            lastEvent: "CLOSE",
          });
          s.resolved = true;
          resolve();
        }
      });
    });
  }

  // ----------------------------
  // XML BUILDERS + PARSER
  // ----------------------------
  static generateFinancialTrxXml({ posId, syncNumber, amountCents, currencyCode }) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<vcs-pos:financialTrxRequest xmlns:vcs-pos="http://www.vibbek.com/pos">
  <posId>${posId}</posId>
  <trxSyncNumber>${syncNumber}</trxSyncNumber>
  <trxData>
    <amount>${amountCents}</amount>
    <currency>${currencyCode}</currency>
    <transactionType>0</transactionType>
    <partialApprovalCap>1</partialApprovalCap>
    <noDCC>true</noDCC>
  </trxData>
  <trxInfo>AAAf</trxInfo>
  <receiptFormat>1</receiptFormat>
  <selectedLang>en</selectedLang>
</vcs-pos:financialTrxRequest>`;
  }

  static generateAbortXml() {
    return `<?xml version="1.0" encoding="utf-8"?>
<vcs-device:abortCardEntryNotification xmlns:vcs-device="http://www.vibbek.com/device">
  <abortCode>01</abortCode>
</vcs-device:abortCardEntryNotification>`;
  }

  static sendAbortStandalone({ ip, port }) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(10000);
      client.connect(port, ip, () => {
        client.write(PayworldController.packFrame(PayworldController.generateAbortXml()), () => {
          client.end();
          resolve();
        });
      });
      client.on("error", (err) => {
        client.destroy();
        reject(err);
      });
      client.on("timeout", () => {
        client.destroy();
        reject(new Error("Timeout while sending abort (standalone)"));
      });
    });
  }

  static parseFinancialTrxResponse(xmlString) {
    const isFinancial =
      xmlString.includes("financialTrxResponse") ||
      xmlString.includes("<vcs-pos:financialTrxResponse");

    if (!isFinancial) {
      return {
        approved: false,
        error: "Onverwachte response van terminal (geen financialTrxResponse)",
        rawXml: xmlString,
      };
    }

    const stripCdata = (s) => {
      if (s == null) return s;
      const trimmed = String(s).trim();
      const m = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
      return (m ? m[1] : trimmed).trim();
    };

    const getTag = (tag) => {
      const re = new RegExp(
        `<([a-zA-Z0-9_-]+:)?${tag}[^>]*>([\\s\\S]*?)</([a-zA-Z0-9_-]+:)?${tag}>`,
        "i"
      );
      const m = xmlString.match(re);
      return m ? stripCdata(m[2]) : null;
    };

    const trxResultStr = getTag("trxResult");
    const ep2AuthResponseCode = getTag("ep2AuthResponseCode");
    const ep2AuthResultStr = getTag("ep2AuthResult");
    const ep2AuthCode = getTag("ep2AuthCode");

    const trxResult = trxResultStr != null ? parseInt(trxResultStr, 10) : null;
    const ep2AuthResult = ep2AuthResultStr != null ? parseInt(ep2AuthResultStr, 10) : null;

    const approved = trxResult === 0;

    let errorMessage = null;
    if (!approved) {
      errorMessage = `Transactie geweigerd (trxResult=${trxResult}, ep2AuthResult=${ep2AuthResult}, code=${ep2AuthResponseCode || "?"})`;
    }

    return {
      approved,
      trxResult,
      ep2AuthResult,
      ep2AuthResponseCode,
      ep2AuthCode,
      rawXml: xmlString,
      error: errorMessage,
    };
  }
}

module.exports = PayworldController;
