// server/src/middleware/hasRole.js
const serversRepo = require('../modules/servers/servers.repository');

function hasRole(...roles) {
  return async (req, res, next) => {
    try {
      const serverId = req.params.id;
      const membership = await serversRepo.getMembership(req.user.userId, serverId);
      if (!membership) return res.status(403).json({ error: 'Not a member of this server' });
      if (!roles.includes(membership.role)) return res.status(403).json({ error: 'Insufficient permissions' });
      req.membership = membership;
      next();
    } catch (err) { next(err); }
  };
}

module.exports = hasRole;
