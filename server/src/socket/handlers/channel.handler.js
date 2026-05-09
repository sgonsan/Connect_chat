// server/src/socket/handlers/channel.handler.js
const serversRepo = require('../../modules/servers/servers.repository');
const channelsRepo = require('../../modules/channels/channels.repository');

function registerChannelHandlers(io, socket) {
  socket.on('channel:join', async ({ channelId }) => {
    try {
      const channel = await channelsRepo.findChannelById(channelId);
      if (!channel) return socket.emit('error', { code: 'NOT_FOUND', message: 'Channel not found' });

      const membership = await serversRepo.getMembership(socket.user.userId, channel.server_id);
      if (!membership) return socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this server' });

      socket.join(`channel:${channelId}`);
    } catch (err) {
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' });
    }
  });

  socket.on('channel:leave', ({ channelId }) => {
    socket.leave(`channel:${channelId}`);
  });
}

module.exports = { registerChannelHandlers };
