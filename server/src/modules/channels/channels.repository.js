// server/src/modules/channels/channels.repository.js
const pool = require('../../db');

async function createChannel(serverId, name, type = 'text') {
  const { rows } = await pool.query(
    'INSERT INTO channels (server_id, name, type) VALUES ($1, $2, $3) RETURNING id, server_id, name, type, created_at',
    [serverId, name, type]
  );
  return rows[0];
}

async function findChannelById(id) {
  const { rows } = await pool.query(
    'SELECT id, server_id, name, type, created_at FROM channels WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function getChannelsByServerId(serverId) {
  const { rows } = await pool.query(
    'SELECT id, server_id, name, type, created_at FROM channels WHERE server_id = $1 ORDER BY created_at ASC',
    [serverId]
  );
  return rows;
}

async function deleteChannel(id) {
  await pool.query('DELETE FROM channels WHERE id = $1', [id]);
}

module.exports = { createChannel, findChannelById, getChannelsByServerId, deleteChannel };
