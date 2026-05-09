// server/src/modules/messages/messages.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./messages.controller');

const channelsRouter = Router({ mergeParams: true });
channelsRouter.use(authenticate);
channelsRouter.get('/', ctrl.getMessages);

const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.delete('/:id', ctrl.deleteMessage);

module.exports = { channelsRouter, messagesRouter };
