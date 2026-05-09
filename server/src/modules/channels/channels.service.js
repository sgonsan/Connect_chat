// server/src/modules/channels/channels.service.js
const channelsRepo = require('./channels.repository');
const serversRepo = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createChannel(serverId, name, userId, type = 'text') {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (!['owner', 'moderator'].includes(membership.role)) throw createError(403, 'Only owner or moderator can create channels');
  return channelsRepo.createChannel(serverId, name, type);
}

async function deleteChannel(channelId, userId) {
  const channel = await channelsRepo.findChannelById(channelId);
  if (!channel) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, channel.server_id);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (!['owner', 'moderator'].includes(membership.role)) throw createError(403, 'Only owner or moderator can delete channels');
  await channelsRepo.deleteChannel(channelId);
  return { serverId: channel.server_id };
}

module.exports = { createChannel, deleteChannel };
