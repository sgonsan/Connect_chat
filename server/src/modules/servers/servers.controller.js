// server/src/modules/servers/servers.controller.js
const serversService = require('./servers.service');

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

module.exports = { createServer, getMyServers, getServerDetail, deleteServer, joinServer, leaveServer, getMembers, updateMemberRole, kickMember };
