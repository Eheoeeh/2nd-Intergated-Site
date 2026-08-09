const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { reportLoginEvent, detectInjection } = require('../utils/csladReporter');
const { checkHoneypotField } = require('../utils/csladHoneypot');

module.exports = async function handler(req, res) {
  // Allow CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  // ── STEP 4: Stop SQL & Script Injections (First Line of Defense) ────────────
  if (detectInjection(username, password)) {
    reportLoginEvent(req, 'injection_attempt');
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // ── STEP 6: Stop Bots using Honeypot ─────────────────────────────────────────
  const botCheck = await checkHoneypotField(req, 'website');
  if (botCheck.is_bot) {
    reportLoginEvent(req, 'blocked');
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ success: false, message: 'DATABASE_URL environment variable is missing on Vercel' });
  }

  try {
    const sql = neon(databaseUrl);

    // Query Neon database for user by username or email
    const result = await sql`
      SELECT id, name, username, email, password_hash, auth_method
      FROM users
      WHERE LOWER(username) = LOWER(${username}) OR LOWER(email) = LOWER(${username})
      LIMIT 1
    `;

    // ── STEP 5: Log Authentication Outcome: User Not Found ─────────────────────
    if (result.length === 0) {
      reportLoginEvent(req, 'not_found');
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result[0];

    // Verify password hash
    const isValid = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    
    // ── STEP 5: Log Authentication Outcome: Wrong Password ────────────────────
    if (!isValid) {
      reportLoginEvent(req, 'failure', user.id, 'user');
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // ── STEP 5: Log Authentication Outcome: Login Success ─────────────────────
    reportLoginEvent(req, 'success', user.id, 'user');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Neon DB Login error:', error);
    return res.status(500).json({ success: false, message: 'Database authentication error', error: error.message });
  }
};
