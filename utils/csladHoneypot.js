/**
 * csladHoneypot.js
 * CSLAD Honeypot Integration — Node.js / Express
 * 
 * HOW TO USE:
 *   1. Copy this file into your project helpers/utils folder (e.g. utils/)
 *   2. Set environment variables:
 *        CSLAD_URL      = http://localhost:5000
 *        CSLAD_API_KEY  = your-api-key-here
 */

const axios = require('axios');
const { _getRealIp } = require('./csladReporter');

const CSLAD_URL   = (process.env.CSLAD_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_KEY     = (process.env.CSLAD_API_KEY || process.env.CSLAD_API || 'cslad-2c04dcf9-975690f73ae3c7cd21ffccda6f602879').trim();
const TIMEOUT_SEC = 2;
const ENABLED     = (process.env.CSLAD_ENABLED || 'true').toLowerCase() !== 'false';

// Memory Cache for Honeypot Field Name to prevent network latency on page renders
let _fieldCache = null;
let _fieldCacheTime = 0;
const CACHE_DURATION_SEC = 300; // 5 minutes

/**
 * TYPE 1 — Check if submitted username is a honeypot account.
 * Call at the START of your login route, before any database query.
 * 
 * Returns: Promise<{ is_honeypot: boolean, block_immediately: boolean }>
 */
async function checkHoneypotCredentials(req) {
  if (!ENABLED) {
    return { is_honeypot: false, block_immediately: false };
  }

  let username = '';
  if (req && req.body) {
    username = req.body.email || req.body.username || '';
  }

  try {
    const response = await axios.post(`${CSLAD_URL}/api/honeypots/check`, {
      username: username,
      ip_address: _getRealIp(req),
      user_agent: (req && req.headers && req.headers['user-agent']) || '',
    }, {
      headers: { 'X-API-Key': API_KEY },
      timeout: TIMEOUT_SEC * 1000,
    });
    
    return {
      is_honeypot: !!response.data.is_honeypot,
      block_immediately: !!response.data.block_immediately,
    };
  } catch (err) {
    console.error('[CSLAD Honeypot] Credential check failed:', err.message);
    return { is_honeypot: false, block_immediately: false };
  }
}

/**
 * TYPE 2 — Get the hidden field name from CSLAD.
 * Inject this as the name of a hidden input in your login HTML.
 * Cache values to prevent adding network latency to page loads.
 * 
 * Returns: Promise<string>
 */
async function getHoneypotFieldName() {
  if (!ENABLED) return 'website';

  const now = Math.floor(Date.now() / 1000);
  if (_fieldCache && (now - _fieldCacheTime < CACHE_DURATION_SEC)) {
    return _fieldCache;
  }

  try {
    const response = await axios.get(`${CSLAD_URL}/api/honeypots/active-fields`, {
      headers: { 'X-API-Key': API_KEY },
      timeout: TIMEOUT_SEC * 1000,
    });
    const fields = response.data.fields || [];
    const fieldName = fields[0] ? fields[0].field_name : 'website';
    _fieldCache = fieldName;
    _fieldCacheTime = now;
    return fieldName;
  } catch (err) {
    console.error('[CSLAD Honeypot] Field fetch failed:', err.message);
    return _fieldCache || 'website';
  }
}

/**
 * TYPE 2 — Check if a bot filled the hidden honeypot field.
 * Call in your login POST route.
 * 
 * Returns: Promise<{ is_bot: boolean, action: string }>
 */
async function checkHoneypotField(req, fieldName, formLoadTimeMs = null) {
  if (!ENABLED) {
    return { is_bot: false, action: 'allow' };
  }

  const formFields = req && req.body ? { ...req.body } : {};

  try {
    const response = await axios.post(`${CSLAD_URL}/api/honeypots/form-check`, {
      form_fields: formFields,
      submission_time_ms: formLoadTimeMs,
      ip_address: _getRealIp(req),
      user_agent: (req && req.headers && req.headers['user-agent']) || '',
    }, {
      headers: { 'X-API-Key': API_KEY },
      timeout: TIMEOUT_SEC * 1000,
    });

    return {
      is_bot: !!response.data.is_bot,
      action: response.data.action || 'allow',
    };
  } catch (err) {
    console.error('[CSLAD Honeypot] Form check failed:', err.message);
    return { is_bot: false, action: 'allow' };
  }
}

module.exports = {
  checkHoneypotCredentials,
  getHoneypotFieldName,
  checkHoneypotField
};
