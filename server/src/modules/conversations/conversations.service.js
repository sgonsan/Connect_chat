// server/src/modules/conversations/conversations.service.js
const repo = require('./conversations.repository');
const { createError } = require('../../middleware/errorHandler');

async function list(userId) {
  return repo.getUserConversations(userId);
}

async function open(myUserId, targetUserId) {
  if (myUserId === targetUserId) throw createError(400, 'Cannot DM yourself');
  const conversationId = await repo.findOrCreate(myUserId, targetUserId);
  return { conversationId };
}

async function getMessages(conversationId, userId, query) {
  const member = await repo.isMember(conversationId, userId);
  if (!member) throw createError(403, 'Not a member of this conversation');
  return repo.getMessages(conversationId, query);
}

async function send(conversationId, userId, content) {
  const member = await repo.isMember(conversationId, userId);
  if (!member) throw createError(403, 'Not a member of this conversation');
  return repo.createMessage(conversationId, userId, content);
}

async function markRead(conversationId, userId) {
  const member = await repo.isMember(conversationId, userId);
  if (!member) throw createError(403, 'Not a member of this conversation');
  await repo.markRead(conversationId, userId);
}

module.exports = { list, open, getMessages, send, markRead };
