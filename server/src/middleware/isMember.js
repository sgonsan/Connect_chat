// server/src/middleware/isMember.js
const serversRepo = require('../modules/servers/servers.repository');

function isMember(serverIdParam = 'id') {
  return async (req, res, next) => {
    const serverId = req.params[serverIdParam];
    const membership = await serversRepo.getMembership(req.user.userId, serverId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this server' });
    }
    req.membership = membership;
    next();
  };
}

module.exports = isMember;
