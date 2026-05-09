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

// Atomically check maxUses, add member, and increment use_count within one transaction.
// Returns 'ok' | 'exhausted' | 'already_member'.
async function joinAtomically(code, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT i.server_id, i.max_uses, i.use_count, i.expires_at
       FROM invites i WHERE i.code = $1 FOR UPDATE`,
      [code]
    );
    const invite = rows[0];
    if (!invite) { await client.query('ROLLBACK'); return 'not_found'; }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) { await client.query('ROLLBACK'); return 'expired'; }
    if (invite.max_uses && invite.use_count >= invite.max_uses) { await client.query('ROLLBACK'); return 'exhausted'; }

    const { rows: mem } = await client.query(
      'SELECT 1 FROM server_members WHERE user_id = $1 AND server_id = $2',
      [userId, invite.server_id]
    );
    if (mem.length) { await client.query('ROLLBACK'); return 'already_member'; }

    await client.query(
      `INSERT INTO server_members (user_id, server_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [userId, invite.server_id]
    );
    await client.query('UPDATE invites SET use_count = use_count + 1 WHERE code = $1', [code]);
    await client.query('COMMIT');
    return { status: 'ok', serverId: invite.server_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createInvite, findInviteByCode, incrementUseCount, joinAtomically };
