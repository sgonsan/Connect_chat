// server/src/modules/servers/servers.service.js
const serversRepo = require('./servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createServer({ name, description }, ownerId) {
  return serversRepo.createServer({ name, description, ownerId });
}

async function getMyServers(userId) {
  return serversRepo.findServersByUser(userId);
}

async function getServerDetail(serverId, userId) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return serversRepo.getServerWithChannels(serverId);
}

async function deleteServer(serverId, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can delete this server');
  await serversRepo.deleteServer(serverId);
}

async function joinServer(inviteCode, userId) {
  const server = await serversRepo.findServerByInviteCode(inviteCode);
  if (!server) throw createError(404, 'Invalid invite code');

  const existing = await serversRepo.getMembership(userId, server.id);
  if (existing) throw createError(409, 'Already a member');

  await serversRepo.addMember(userId, server.id);
  return server;
}

async function leaveServer(serverId, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id === userId) throw createError(400, 'Owner cannot leave — delete the server instead');

  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(404, 'Not a member');

  await serversRepo.removeMember(userId, serverId);
}

async function getMembers(serverId, userId) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return serversRepo.getMembersByServer(serverId);
}

async function updateMemberRole(serverId, targetUserId, newRole) {
  const target = await serversRepo.getMembership(targetUserId, serverId);
  if (!target) throw createError(404, 'Member not found');
  if (target.role === 'owner') throw createError(400, 'Cannot change the owner\'s role');
  if (!['moderator', 'member'].includes(newRole)) throw createError(400, 'Invalid role');
  return serversRepo.updateMemberRole(targetUserId, serverId, newRole);
}

async function kickMember(serverId, targetUserId, requesterId) {
  const target = await serversRepo.getMembership(targetUserId, serverId);
  if (!target) throw createError(404, 'Member not found');
  if (target.role === 'owner') throw createError(400, 'Cannot kick the server owner');
  const requester = await serversRepo.getMembership(requesterId, serverId);
  if (!requester) throw createError(403, 'Not a member');
  if (requester.role === 'member') throw createError(403, 'Insufficient permissions');
  if (requester.role === 'moderator' && target.role === 'moderator') throw createError(403, 'Moderators cannot kick other moderators');
  await serversRepo.removeMember(targetUserId, serverId);
}

module.exports = { createServer, getMyServers, getServerDetail, deleteServer, joinServer, leaveServer, getMembers, updateMemberRole, kickMember };
