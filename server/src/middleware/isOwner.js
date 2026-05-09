// server/src/middleware/isOwner.js
const serversRepo = require('../modules/servers/servers.repository');

function isOwner(serverIdParam = 'id') {
  return async (req, res, next) => {
    const serverId = req.params[serverIdParam];
    const server = await serversRepo.findServerById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.owner_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the server owner can do this' });
    }
    req.server = server;
    next();
  };
}

module.exports = isOwner;
