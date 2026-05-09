// server/src/socket/handlers/presence.handler.js

function registerPresenceHandlers(io, socket) {
  const { userId } = socket.user;

  // Notify others in a server room that this user is online
  socket.on('server:presence_hello', async ({ serverId }) => {
    const roomName = `server:${serverId}`;
    // Get userIds of all sockets currently in this room
    const sockets = await io.in(roomName).fetchSockets();
    const onlineUserIds = [...new Set(sockets.map(s => s.user?.userId).filter(Boolean))];
    // Send current online list to the joining socket
    socket.emit('presence:list', { serverId, onlineUserIds });
    // Tell others this user came online
    socket.to(roomName).emit('presence:online', { userId });
  });

  // Typing indicators — broadcast to channel room excluding sender
  socket.on('typing:start', ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId,
      isTyping: true,
    });
  });

  socket.on('typing:stop', ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId,
      isTyping: false,
    });
  });

  // On disconnect, notify server rooms where this user was present
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('server:')) {
        // Check if user has other active sockets in this room
        io.in(room).fetchSockets().then(sockets => {
          const others = sockets.filter(s => s.id !== socket.id && s.user?.userId === userId);
          if (others.length === 0) {
            // Last socket for this user in this room
            socket.to(room).emit('presence:offline', { userId });
          }
        });
      }
    }
  });
}

module.exports = { registerPresenceHandlers };
