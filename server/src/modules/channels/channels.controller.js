// server/src/modules/channels/channels.controller.js
const channelsService = require('./channels.service');

async function createChannel(req, res, next) {
  try {
    const channel = await channelsService.createChannel(req.params.id, req.body.name, req.user.userId);
    res.status(201).json(channel);
  } catch (err) { next(err); }
}

async function deleteChannel(req, res, next) {
  try {
    await channelsService.deleteChannel(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { createChannel, deleteChannel };
