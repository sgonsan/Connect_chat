// server/src/modules/users/users.repository.js
const pool = require('../../db');

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function updateUser(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE users SET ${set} WHERE id = $1
     RETURNING id, username, email, avatar_url, created_at`,
    [id, ...values]
  );
  return rows[0] || null;
}

module.exports = { findById, updateUser };
