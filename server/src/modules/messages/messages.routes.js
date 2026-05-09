// server/src/modules/messages/messages.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { editMessageSchema } = require('./messages.schema');
const ctrl = require('./messages.controller');

const channelsRouter = Router({ mergeParams: true });
channelsRouter.use(authenticate);
channelsRouter.get('/', ctrl.getMessages);

const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.patch('/:id', validate(editMessageSchema), ctrl.editMessage);
messagesRouter.delete('/:id', ctrl.deleteMessage);
messagesRouter.post('/:id/reactions/:emoji', ctrl.toggleReaction);

module.exports = { channelsRouter, messagesRouter };
