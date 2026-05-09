// server/src/modules/channels/channels.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { createChannelSchema } = require('./channels.schema');
const ctrl = require('./channels.controller');
const messagesCtrl = require('../messages/messages.controller');

const serversRouter = Router({ mergeParams: true });
serversRouter.use(authenticate);
serversRouter.post('/', validate(createChannelSchema), ctrl.createChannel);

const channelsRouter = Router();
channelsRouter.use(authenticate);
channelsRouter.delete('/:id', ctrl.deleteChannel);
channelsRouter.patch('/:id/read', messagesCtrl.markChannelRead);

module.exports = { serversRouter, channelsRouter };
