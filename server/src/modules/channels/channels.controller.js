// server/src/modules/channels/channels.controller.js
const channelsService = require('./channels.service');

async function createChannel(req, res, next) {
  try {
    const { name, type } = req.body;
    const channel = await channelsService.createChannel(req.params.id, name, req.user.userId, type);
    req.app.locals.io?.to(`server:${req.params.id}`).emit('server:channel_created', channel);
    res.status(201).json(channel);
  } catch (err) { next(err); }
}

async function deleteChannel(req, res, next) {
  try {
    const channel = await channelsService.deleteChannel(req.params.id, req.user.userId);
    req.app.locals.io?.to(`server:${channel.serverId}`).emit('server:channel_deleted', { channelId: req.params.id, serverId: channel.serverId });
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { createChannel, deleteChannel };
