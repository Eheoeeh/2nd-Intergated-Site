/**
 * csladReporter.js
 * CSLAD Login Event Reporter — Node.js / Express / Vercel Serverless
 */

const axios = require('axios');

// ── Config ────────────────────────────────────────────────────────────────────
const CSLAD_URL   = (process.env.CSLAD_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_KEY     = (process.env.CSLAD_API_KEY || process.env.CSLAD_API || 'your-api-key-here').trim();
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
};

/**
 * Returns true if the email or password contains injection patterns.
 * Call BEFORE querying your database to block obvious SQLi or script injections.
 */
function detectInjection(email, password) {
  return INJECTION_PATTERN.test(String(email || '')) || INJECTION_PATTERN.test(String(password || ''));
}

/**
 * Helper to extract client real IP from Express / Serverless request object
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
    account_role: accountRole || 'user',
    user_id: userId,
  };

  // Fire-and-forget: run asynchronously in the event loop, catch errors silently
  axios.post(`${CSLAD_URL}/api/client/log-event`, payload, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true'
    },
    timeout: TIMEOUT_SEC * 1000
  }).catch((err) => {
    console.error('[CSLAD] Reporting failed:', err.message);
  });
}

/**
 * Synchronously checks if the client IP is blocked by CSLAD before authenticating.
 * Returns { is_blocked: true, blocked_until: string } if blocked, or { is_blocked: false } if clean.
 */
async function checkIpBlocked(req) {
  if (!ENABLED) return { is_blocked: false };

  const clientIp = _getRealIp(req);
  try {
    const response = await axios.get(`${CSLAD_URL}/api/client/check-ip`, {
      params: { ip: clientIp },
      headers: { 
        'X-API-Key': API_KEY,
        'bypass-tunnel-reminder': 'true'
      },
      timeout: TIMEOUT_SEC * 1000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 403 || response.data?.is_blocked) {
      return {
        is_blocked: true,
        blocked_until: response.data?.blocked_until || null,
        recommendation: response.data?.recommendation || 'block'
      };
    }
    return { is_blocked: false };
  } catch (err) {
    console.error('[CSLAD] Pre-check failed (failing open):', err.message);
    return { is_blocked: false };
  }
}

module.exports = {
  detectInjection,
  reportLoginEvent,
  checkIpBlocked,
  _getRealIp
};
