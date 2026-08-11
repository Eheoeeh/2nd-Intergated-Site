/**
 * csladReporter.js
 * CSLAD Login Event Reporter — Node.js / Express
 * 
 * HOW TO USE:
 *   1. Copy this file into your project helpers/utils folder (e.g. utils/)
 *   2. Set environment variables:
 *        CSLAD_URL      = http://localhost:5000
 *        CSLAD_API_KEY  = your-api-key-here
 *   3. Call reportLoginEvent() at every login decision point
 */

const axios = require('axios');
const http = require('http');
const https = require('https');

const keepAliveOffHttpAgent = new http.Agent({ keepAlive: false });
const keepAliveOffHttpsAgent = new https.Agent({ keepAlive: false });

// ── Config ────────────────────────────────────────────────────────────────────
const CSLAD_URL   = (process.env.CSLAD_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_KEY     = (process.env.CSLAD_API_KEY || process.env.CSLAD_API || 'cslad-2c04dcf9-975690f73ae3c7cd21ffccda6f602879').trim();
const TIMEOUT_SEC = 2; // seconds
const ENABLED     = (process.env.CSLAD_ENABLED || 'true').toLowerCase() !== 'false';

// ── Injection pattern ─────────────────────────────────────────────────────────
const INJECTION_PATTERN = /('|--|;|\/\*|\*\/|xp_|union\s+select|<script|javascript:|on\w+=|\{\{|\}\}|169\.254)/i;

const FAILURE_REASONS = {
  'failure':           'invalid_credentials',
  'blocked':           'account_deactivated',
  'not_found':         'user_not_found',
  'injection_attempt': 'injection_attempt',
  'locked':            'account_locked',
  'error':             'system_error',
};

/**
 * Returns true if the email or password contains injection patterns.
 * Call BEFORE querying your database to block obvious SQLi or script injections.
 */
function detectInjection(email, password) {
  return INJECTION_PATTERN.test(String(email || '')) || INJECTION_PATTERN.test(String(password || ''));
}

/**
 * Helper to extract client real IP from Express request object
 */
function _getRealIp(req) {
  if (req && req.headers) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
  }
  return (req && (req.ip || (req.connection && req.connection.remoteAddress))) || '0.0.0.0';
}

/**
 * Reports a login event to CSLAD asynchronously (fire-and-forget).
 * It will execute in the background and won't block your auth response.
 */
function reportLoginEvent(req, outcome, userId = null, accountRole = null) {
  if (!ENABLED) return;

  let username = '';
  if (req && req.body) {
    username = req.body.email || req.body.username || '';
  }

  const payload = {
    ip_address: _getRealIp(req),
    username: String(username).trim(),
    success: outcome === 'success',
    user_agent: (req && req.headers && req.headers['user-agent']) || '',
    failure_reason: FAILURE_REASONS[outcome] || null,
    account_role: accountRole,
    user_id: userId,
  };

  // Fire-and-forget: run asynchronously in the event loop, catch errors silently
  axios.post(`${CSLAD_URL}/api/client/log-event`, payload, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    httpAgent: keepAliveOffHttpAgent,
    httpsAgent: keepAliveOffHttpsAgent,
    timeout: TIMEOUT_SEC * 1000
  }).catch((err) => {
    console.error('[CSLAD] Reporting failed:', err.message);
  });
}

/**
 * Checks if client IP is blocked by CSLAD rate limiter / firewall.
 * Call at Step 0 of your login route BEFORE database / auth logic.
 * Returns true if blocked (HTTP 403 or blocked:true), false otherwise.
 * Fails open (returns false) on network error.
 */
async function checkIpBlocked(req) {
  if (!ENABLED) return false;
  try {
    const ip = _getRealIp(req);
    const res = await axios.get(`${CSLAD_URL}/api/client/check-ip`, {
      params: { ip: ip },
      headers: { 'X-API-Key': API_KEY },
      httpAgent: keepAliveOffHttpAgent,
      httpsAgent: keepAliveOffHttpsAgent,
      timeout: TIMEOUT_SEC * 1000,
      validateStatus: () => true
    });
    if (res.status === 403 || (res.data && res.data.blocked)) {
      return true;
    }
    return false;
  } catch (err) {
    console.error('[CSLAD] checkIpBlocked failed (failing open):', err.message);
    return false;
  }
}

module.exports = {
  detectInjection,
  checkIpBlocked,
  reportLoginEvent,
  _getRealIp
};
