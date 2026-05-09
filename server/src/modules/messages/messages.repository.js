// server/src/modules/messages/messages.repository.js
const pool = require('../../db');

async function createMessage({ channelId, userId, content }) {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO messages (channel_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *
     )
     SELECT i.id, i.channel_id, i.content, i.created_at, i.edited_at,
            json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS user
     FROM inserted i
     JOIN users u ON u.id = i.user_id`,
    [channelId, userId, content]
  );
  return rows[0];
}

async function getMessages(channelId, { before, limit }) {
  let query = `
    SELECT m.id, m.channel_id, m.content, m.created_at, m.edited_at,
           json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS user
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = $1
  `;
  const params = [channelId];

  if (before) {
    params.push(before);
    query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
  }

  params.push(limit);
  query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

  const { rows } = await pool.query(query, params);
  return rows.reverse();
}

async function findMessageById(id) {
  const { rows } = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return rows[0] || null;
}

async function editMessage(id, content) {
  const { rows } = await pool.query(
    `UPDATE messages SET content = $1, edited_at = NOW()
     WHERE id = $2
     RETURNING id, channel_id, content, created_at, edited_at`,
    [content, id]
  );
  return rows[0] || null;
}

async function deleteMessage(id) {
  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
}

async function getChannelServerId(channelId) {
  const { rows } = await pool.query(
    'SELECT server_id FROM channels WHERE id = $1',
    [channelId]
  );
  return rows[0]?.server_id || null;
}

module.exports = { createMessage, getMessages, findMessageById, editMessage, deleteMessage, getChannelServerId };
