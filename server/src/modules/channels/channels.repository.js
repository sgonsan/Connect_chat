// server/src/modules/channels/channels.repository.js
const pool = require('../../db');

async function createChannel(serverId, name, type = 'text', category = null) {
  const { rows } = await pool.query(
    `INSERT INTO channels (server_id, name, type, category)
     VALUES ($1, $2, $3, $4)
     RETURNING id, server_id, name, type, category, created_at`,
    [serverId, name, type, category || null]
  );
  return rows[0];
}

async function findChannelById(id) {
  const { rows } = await pool.query(
    'SELECT id, server_id, name, type, category, created_at FROM channels WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function getChannelsByServerId(serverId) {
  const { rows } = await pool.query(
    'SELECT id, server_id, name, type, category, created_at FROM channels WHERE server_id = $1 ORDER BY created_at ASC',
    [serverId]
  );
  return rows;
}

async function deleteChannel(id) {
  await pool.query('DELETE FROM channels WHERE id = $1', [id]);
}

module.exports = { createChannel, findChannelById, getChannelsByServerId, deleteChannel };
