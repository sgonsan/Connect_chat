// server/src/modules/invites/invites.repository.js
const pool = require('../../db');

async function createInvite({ code, serverId, creatorId, expiresAt, maxUses }) {
  const { rows } = await pool.query(
    `INSERT INTO invites (code, server_id, creator_id, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [code, serverId, creatorId, expiresAt || null, maxUses || null]
  );
  return rows[0];
}

async function findInviteByCode(code) {
  const { rows } = await pool.query(
    `SELECT i.*, s.name AS server_name,
            (SELECT COUNT(*) FROM server_members WHERE server_id = i.server_id)::int AS member_count,
            u.username AS creator_username
     FROM invites i
     JOIN servers s ON s.id = i.server_id
     JOIN users   u ON u.id = i.creator_id
     WHERE i.code = $1`,
    [code]
  );
  return rows[0] || null;
}

async function incrementUseCount(code) {
  await pool.query('UPDATE invites SET use_count = use_count + 1 WHERE code = $1', [code]);
}

module.exports = { createInvite, findInviteByCode, incrementUseCount };
