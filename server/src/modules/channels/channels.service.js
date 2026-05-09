// server/src/modules/channels/channels.service.js
const channelsRepo = require('./channels.repository');
const serversRepo = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createChannel(serverId, name, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can create channels');
  return channelsRepo.createChannel(serverId, name);
}

async function deleteChannel(channelId, userId) {
  const channel = await channelsRepo.findChannelById(channelId);
  if (!channel) throw createError(404, 'Channel not found');
  const server = await serversRepo.findServerById(channel.server_id);
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can delete channels');
  await channelsRepo.deleteChannel(channelId);
}

module.exports = { createChannel, deleteChannel };
