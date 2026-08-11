const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

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

  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ success: false, message: 'DATABASE_URL environment variable is missing on Vercel' });
  }

  try {
    const sql = neon(databaseUrl, { fetchOptions: { signal: AbortSignal.timeout(3000) } });

    // Derive clean username from email prefix
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Check if email or username already exists in Neon DB
    const existing = await sql`
      SELECT id FROM users
      WHERE LOWER(email) = LOWER(${email}) OR LOWER(username) = LOWER(${username})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'This email address or username is already registered' });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into Neon DB
    const inserted = await sql`
      INSERT INTO users (name, username, email, password_hash)
      VALUES (${name}, ${username}, ${email}, ${passwordHash})
      RETURNING id, name, username, email, created_at
    `;

    const newUser = inserted[0];

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Neon DB Signup error:', error);
    return res.status(500).json({ success: false, message: 'Registration database error', error: error.message });
  }
};
