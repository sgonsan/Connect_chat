// server/src/modules/servers/servers.controller.js
const serversService = require('./servers.service');
const pool = require('../../db');

async function createServer(req, res, next) {
  try {
    const server = await serversService.createServer(req.body, req.user.userId);
    res.status(201).json(server);
  } catch (err) { next(err); }
}

async function getMyServers(req, res, next) {
  try {
    res.json(await serversService.getMyServers(req.user.userId));
  } catch (err) { next(err); }
}

async function getServerDetail(req, res, next) {
  try {
    const server = await serversService.getServerDetail(req.params.id, req.user.userId);
    res.json(server);
  } catch (err) { next(err); }
}

async function deleteServer(req, res, next) {
  try {
    await serversService.deleteServer(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function joinServer(req, res, next) {
  try {
    const server = await serversService.joinServer(req.body.invite_code, req.user.userId);
    res.json(server);
  } catch (err) { next(err); }
}

async function leaveServer(req, res, next) {
  try {
    await serversService.leaveServer(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getMembers(req, res, next) {
  try {
    const members = await serversService.getMembers(req.params.id, req.user.userId);
    res.json(members);
  } catch (err) { next(err); }
}

async function updateMemberRole(req, res, next) {
  try {
    const updated = await serversService.updateMemberRole(
      req.params.id, req.params.userId, req.body.role
    );
    res.json(updated);
  } catch (err) { next(err); }
}

async function kickMember(req, res, next) {
  try {
    await serversService.kickMember(req.params.id, req.params.userId, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getUnreadCounts(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT ch.id AS channel_id, COUNT(m.id)::int AS count
       FROM channels ch
       LEFT JOIN channel_reads cr ON cr.channel_id = ch.id AND cr.user_id = $1
       LEFT JOIN messages m ON m.channel_id = ch.id
         AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
       WHERE ch.server_id = $2
       GROUP BY ch.id`,
      [req.user.userId, req.params.id]
    );
    const result = {};
    for (const row of rows) result[row.channel_id] = row.count;
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { createServer, getMyServers, getServerDetail, deleteServer, joinServer, leaveServer, getMembers, updateMemberRole, kickMember, getUnreadCounts };
