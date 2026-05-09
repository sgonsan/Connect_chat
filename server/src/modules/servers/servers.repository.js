// server/src/modules/servers/servers.repository.js
const pool = require('../../db');

async function createServer({ name, description, ownerId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO servers (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, ownerId]
    );
    const server = rows[0];
    await client.query(
      `INSERT INTO server_members (user_id, server_id, role)
       VALUES ($1, $2, 'owner')`,
      [ownerId, server.id]
    );
    await client.query('COMMIT');
    return server;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findServersByUser(userId) {
  const { rows } = await pool.query(
    `SELECT s.* FROM servers s
     JOIN server_members sm ON sm.server_id = s.id
     WHERE sm.user_id = $1
     ORDER BY s.created_at ASC`,
    [userId]
  );
  return rows;
}

async function findServerById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM servers WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findServerByInviteCode(inviteCode) {
  const { rows } = await pool.query(
    'SELECT * FROM servers WHERE invite_code = $1',
    [inviteCode]
  );
  return rows[0] || null;
}

async function deleteServer(id) {
  await pool.query('DELETE FROM servers WHERE id = $1', [id]);
}

async function addMember(userId, serverId) {
  await pool.query(
    `INSERT INTO server_members (user_id, server_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [userId, serverId]
  );
}

async function removeMember(userId, serverId) {
  await pool.query(
    'DELETE FROM server_members WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  );
}

async function getMembership(userId, serverId) {
  const { rows } = await pool.query(
    'SELECT * FROM server_members WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  );
  return rows[0] || null;
}

async function getServerWithChannels(serverId) {
  const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
  const server = serverRes.rows[0];
  if (!server) return null;

  const channelsRes = await pool.query(
    'SELECT * FROM channels WHERE server_id = $1 ORDER BY created_at ASC',
    [serverId]
  );
  return { ...server, channels: channelsRes.rows };
}

async function getMembersByServer(serverId) {
  const { rows } = await pool.query(
    `SELECT sm.user_id AS id, sm.role, sm.joined_at,
            u.username, u.avatar_url
     FROM server_members sm
     JOIN users u ON u.id = sm.user_id
     WHERE sm.server_id = $1
     ORDER BY
       CASE sm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
       u.username ASC`,
    [serverId]
  );
  return rows;
}

async function updateMemberRole(userId, serverId, role) {
  const { rows } = await pool.query(
    `UPDATE server_members SET role = $1
     WHERE user_id = $2 AND server_id = $3
     RETURNING user_id AS id, role, joined_at`,
    [role, userId, serverId]
  );
  return rows[0] || null;
}

module.exports = {
  createServer, findServersByUser, findServerById,
  findServerByInviteCode, deleteServer, addMember,
  removeMember, getMembership, getServerWithChannels,
  getMembersByServer, updateMemberRole,
};
