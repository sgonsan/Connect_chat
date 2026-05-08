const pool = require('../../db');

async function createUser({ username, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, avatar_url, created_at`,
    [username, email, passwordHash]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createRefreshToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findActiveRefreshToken(tokenHash) {
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findActiveRefreshToken,
  revokeRefreshToken,
};
