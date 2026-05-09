// server/src/modules/channels/channels.repository.js
const pool = require('../../db');

async function createChannel(serverId, name) {
  const { rows } = await pool.query(
    'INSERT INTO channels (server_id, name) VALUES ($1, $2) RETURNING *',
    [serverId, name]
  );
  return rows[0];
}

async function findChannelById(id) {
  const { rows } = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
  return rows[0] || null;
}

async function deleteChannel(id) {
  await pool.query('DELETE FROM channels WHERE id = $1', [id]);
}

module.exports = { createChannel, findChannelById, deleteChannel };
