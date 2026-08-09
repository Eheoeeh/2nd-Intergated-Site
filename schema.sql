-- Schema definition for Neon PostgreSQL database
-- Execute these statements in your Neon SQL Editor console (https://console.neon.tech)

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by username and email
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- Default Admin User (Password: password123)
-- Hash generated with bcrypt (10 salt rounds)
INSERT INTO users (name, username, email, password_hash)
VALUES (
  'Aura Administrator',
  'admin',
  'admin@aura.io',
  '$2a$10$w8.sE8qgN93tO4e7R4F2s.1Y8k3V3eW8u9gN93tO4e7R4F2s.1Y8k'
)
ON CONFLICT (username) DO NOTHING;
