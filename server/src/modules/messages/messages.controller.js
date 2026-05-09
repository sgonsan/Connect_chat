// server/src/modules/messages/messages.controller.js
const messagesService = require('./messages.service');
const { getMessagesSchema } = require('./messages.schema');

async function getMessages(req, res, next) {
  try {
    const query = getMessagesSchema.parse(req.query);
    const messages = await messagesService.getMessages(req.params.id, query, req.user.userId);
    res.json(messages);
  } catch (err) { next(err); }
}

async function deleteMessage(req, res, next) {
  try {
    await messagesService.deleteMessage(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getMessages, deleteMessage };
