const { neon } = require('@neondatabase/serverless');

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

  const { name, email, picture } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required for Google Sign-In' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ success: false, message: 'DATABASE_URL environment variable is missing on Vercel' });
  }

  try {
    const sql = neon(databaseUrl);

    // Derive a clean username from email
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Check if user already exists in Neon DB
    const existing = await sql`
      SELECT id, name, username, email, picture, auth_method
      FROM users
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;

    if (existing.length > 0) {
      const user = existing[0];
      // Update picture if provided
      if (picture && !user.picture) {
        await sql`
          UPDATE users SET picture = ${picture} WHERE id = ${user.id}
        `;
      }
      return res.status(200).json({
        success: true,
        message: 'Google login successful',
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          picture: picture || user.picture,
          auth_method: user.auth_method
        }
      });
    }

    // Insert new Google user into Neon DB
    const inserted = await sql`
      INSERT INTO users (name, username, email, picture, auth_method)
      VALUES (${name || username}, ${username}, ${email}, ${picture || ''}, 'google')
      RETURNING id, name, username, email, picture, auth_method
    `;

    const newUser = inserted[0];

    return res.status(201).json({
      success: true,
      message: 'Google user registered in Neon DB',
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        picture: newUser.picture,
        auth_method: 'google'
      }
    });
  } catch (error) {
    console.error('Neon DB Google Auth error:', error);
    return res.status(500).json({ success: false, message: 'Google auth database error', error: error.message });
  }
};
