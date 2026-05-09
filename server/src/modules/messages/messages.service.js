// server/src/modules/messages/messages.service.js
const messagesRepo = require('./messages.repository');
const serversRepo = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function getMessages(channelId, query, userId) {
  const serverId = await messagesRepo.getChannelServerId(channelId);
  if (!serverId) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return messagesRepo.getMessages(channelId, query);
}

async function createMessage({ channelId, userId, content }) {
  const serverId = await messagesRepo.getChannelServerId(channelId);
  if (!serverId) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return messagesRepo.createMessage({ channelId, userId, content });
}

async function deleteMessage(messageId, userId) {
  const message = await messagesRepo.findMessageById(messageId);
  if (!message) throw createError(404, 'Message not found');

  if (message.user_id !== userId) {
    const serverId = await messagesRepo.getChannelServerId(message.channel_id);
    const membership = await serversRepo.getMembership(userId, serverId);
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      throw createError(403, "Cannot delete another user's message");
    }
  }

  await messagesRepo.deleteMessage(messageId);
  return { messageId, channelId: message.channel_id };
}

module.exports = { getMessages, createMessage, deleteMessage };
