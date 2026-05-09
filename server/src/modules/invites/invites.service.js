// server/src/modules/invites/invites.service.js
const { nanoid }   = require('nanoid');
const invitesRepo  = require('./invites.repository');
const serversRepo  = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createInvite(serverId, userId, { expiresIn, maxUses } = {}) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (membership.role === 'member') throw createError(403, 'Only owner or moderator can create invites');

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;
  const code = nanoid(10);

  const invite = await invitesRepo.createInvite({ code, serverId, creatorId: userId, expiresAt, maxUses });
  const baseUrl = process.env.ALLOWED_ORIGIN || 'http://localhost:4000';
  return {
    code:      invite.code,
    url:       `${baseUrl}/invite/${invite.code}`,
    expiresAt: invite.expires_at,
    maxUses:   invite.max_uses,
    useCount:  invite.use_count,
  };
}

async function previewInvite(code) {
  const invite = await invitesRepo.findInviteByCode(code);
  if (!invite) throw createError(404, 'Invite not found');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw createError(410, 'Invite expired');
  if (invite.max_uses && invite.use_count >= invite.max_uses) throw createError(410, 'Invite has reached its maximum uses');
  return {
    serverName:       invite.server_name,
    serverIdHint:     invite.server_id,
    memberCount:      invite.member_count,
    inviterUsername:  invite.creator_username,
    expiresAt:        invite.expires_at,
    maxUses:          invite.max_uses,
    useCount:         invite.use_count,
  };
}

async function joinViaInvite(code, userId) {
  const invite = await invitesRepo.findInviteByCode(code);
  if (!invite) throw createError(404, 'Invite not found');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw createError(410, 'Invite expired');
  if (invite.max_uses && invite.use_count >= invite.max_uses) throw createError(410, 'Invite has reached its maximum uses');

  const existing = await serversRepo.getMembership(userId, invite.server_id);
  if (existing) throw createError(409, 'Already a member');

  await serversRepo.addMember(userId, invite.server_id);
  await invitesRepo.incrementUseCount(code);
  return { serverId: invite.server_id, serverName: invite.server_name };
}

module.exports = { createInvite, previewInvite, joinViaInvite };
