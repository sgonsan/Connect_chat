// server/src/modules/conversations/conversations.repository.js
const pool = require('../../db');

async function findOrCreate(userId1, userId2) {
  const { rows } = await pool.query(
    `SELECT cm1.conversation_id
     FROM conversation_members cm1
     JOIN conversation_members cm2
       ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = $2
     WHERE cm1.user_id = $1`,
    [userId1, userId2]
  );
  if (rows[0]) return rows[0].conversation_id;

  const { rows: conv } = await pool.query(
    'INSERT INTO conversations DEFAULT VALUES RETURNING id'
  );
  const id = conv[0].id;
  await pool.query(
    'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2),($1,$3)',
    [id, userId1, userId2]
  );
  return id;
}

async function getUserConversations(userId) {
  const { rows } = await pool.query(
    `SELECT c.id,
            json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS other_user,
            (SELECT content    FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) AS last_message_at,
            (SELECT COUNT(dm.id)::int
             FROM direct_messages dm
             WHERE dm.conversation_id = c.id
               AND dm.created_at > COALESCE(
                 (SELECT last_read_at FROM conversation_members WHERE conversation_id = c.id AND user_id = $1),
                 '1970-01-01'
               )
            ) AS unread_count
     FROM conversations c
     JOIN conversation_members my_mem    ON my_mem.conversation_id = c.id    AND my_mem.user_id = $1
     JOIN conversation_members other_mem ON other_mem.conversation_id = c.id AND other_mem.user_id != $1
     JOIN users u ON u.id = other_mem.user_id
     ORDER BY last_message_at DESC NULLS LAST`,
    [userId]
  );
  return rows;
}

async function isMember(conversationId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2',
    [conversationId, userId]
  );
  return rows.length > 0;
}

async function getMessages(conversationId, { before, limit = 50 } = {}) {
  let query = `
    SELECT dm.id, dm.conversation_id, dm.content, dm.created_at, dm.edited_at,
           json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS user
    FROM direct_messages dm
    JOIN users u ON u.id = dm.user_id
    WHERE dm.conversation_id = $1
  `;
  const params = [conversationId];
  if (before) {
    params.push(before);
    query += ` AND dm.created_at < (SELECT created_at FROM direct_messages WHERE id = $${params.length})`;
  }
  params.push(limit);
  query += ` ORDER BY dm.created_at DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(query, params);
  return rows.reverse();
}

async function createMessage(conversationId, userId, content) {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO direct_messages (conversation_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING *
     )
     SELECT dm.id, dm.conversation_id, dm.content, dm.created_at, dm.edited_at,
            json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS user
     FROM inserted dm JOIN users u ON u.id = dm.user_id`,
    [conversationId, userId, content]
  );
  await pool.query(
    `UPDATE conversation_members SET last_read_at = NOW()
     WHERE conversation_id=$1 AND user_id=$2`,
    [conversationId, userId]
  );
  return rows[0];
}

async function markRead(conversationId, userId) {
  await pool.query(
    `UPDATE conversation_members SET last_read_at = NOW()
     WHERE conversation_id=$1 AND user_id=$2`,
    [conversationId, userId]
  );
}

module.exports = { findOrCreate, getUserConversations, isMember, getMessages, createMessage, markRead };
