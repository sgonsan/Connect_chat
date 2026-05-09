// server/src/socket/gateway.js
const { verifyAccessToken } = require('../config/jwt');
const { registerChannelHandlers } = require('./handlers/channel.handler');
const { registerMessageHandlers } = require('./handlers/message.handler');

function setupGateway(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user.userId})`);

    registerChannelHandlers(io, socket);
    registerMessageHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupGateway };
