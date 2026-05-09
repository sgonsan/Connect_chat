// server/src/socket/handlers/message.handler.js
const messagesService = require('../../modules/messages/messages.service');
const convsService = require('../../modules/conversations/conversations.service');

const VALID_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👀'];

function registerMessageHandlers(io, socket) {
  socket.on('message:send', async ({ channelId, content }) => {
    try {
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return socket.emit('error', { code: 'VALIDATION', message: 'Content is required' });
      }
      if (content.length > 2000) {
        return socket.emit('error', { code: 'VALIDATION', message: 'Message too long' });
      }

      const message = await messagesService.createMessage({
        channelId,
        userId: socket.user.userId,
        content: content.trim(),
      });

      io.to(`channel:${channelId}`).emit('message:new', message);
    } catch (err) {
      const code = err.status === 403 ? 'FORBIDDEN' : 'INTERNAL';
      socket.emit('error', { code, message: err.message });
    }
  });

  socket.on('message:edit', async ({ messageId, content }) => {
    try {
      if (!content?.trim()) return socket.emit('error', { code: 'VALIDATION', message: 'Content required' });
      const message = await messagesService.editMessage(messageId, socket.user.userId, content.trim());
      if (!message) return;
      io.to(`channel:${message.channel_id}`).emit('message:edited', {
        id:        message.id,
        channelId: message.channel_id,
        content:   message.content,
        editedAt:  message.edited_at,
      });
    } catch (err) {
      socket.emit('error', { code: err.status === 403 ? 'FORBIDDEN' : 'INTERNAL', message: err.message });
    }
  });

  socket.on('message:delete', async ({ messageId }) => {
    try {
      const { channelId } = await messagesService.deleteMessage(messageId, socket.user.userId);
      io.to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
    } catch (err) {
      const code = err.status === 403 ? 'FORBIDDEN' : err.status === 404 ? 'NOT_FOUND' : 'INTERNAL';
      socket.emit('error', { code, message: err.message });
    }
  });

  socket.on('message:react', async ({ messageId, emoji }) => {
    try {
      if (!VALID_EMOJIS.includes(emoji))
        return socket.emit('error', { code: 'VALIDATION', message: 'Invalid emoji' });
      const result = await messagesService.toggleReaction(messageId, socket.user.userId, emoji);
      io.to(`channel:${result.channelId}`).emit('message:reacted', {
        messageId: result.messageId,
        reactions: result.reactions,
      });
    } catch (err) {
      socket.emit('error', { code: err.status === 403 ? 'FORBIDDEN' : 'INTERNAL', message: err.message });
    }
  });

  socket.on('dm:join', async ({ conversationId }) => {
    try {
      const member = await convsService.getMessages(conversationId, socket.user.userId, { limit: 1 })
        .then(() => true).catch(() => false);
      if (!member) return socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member' });
      socket.join(`dm:${conversationId}`);
    } catch {
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' });
    }
  });

  socket.on('dm:leave', ({ conversationId }) => {
    socket.leave(`dm:${conversationId}`);
  });

  socket.on('dm:send', async ({ conversationId, content }) => {
    try {
      if (!content?.trim()) return socket.emit('error', { code: 'VALIDATION', message: 'Content required' });
      const message = await convsService.send(conversationId, socket.user.userId, content.trim());
      io.to(`dm:${conversationId}`).emit('dm:new', message);
    } catch (err) {
      socket.emit('error', { code: err.status === 403 ? 'FORBIDDEN' : 'INTERNAL', message: err.message });
    }
  });
}

module.exports = { registerMessageHandlers };
