// server/src/modules/messages/messages.controller.js
const messagesService = require('./messages.service');
const { getMessagesSchema } = require('./messages.schema');
const pool = require('../../db');

const VALID_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','👀'];


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

async function editMessage(req, res, next) {
  try {
    const message = await messagesService.editMessage(req.params.id, req.user.userId, req.body.content);
    res.json(message);
  } catch (err) { next(err); }
}

async function toggleReaction(req, res, next) {
  try {
    if (!VALID_EMOJIS.includes(req.params.emoji))
      return res.status(400).json({ error: 'Invalid emoji' });
    const result = await messagesService.toggleReaction(req.params.id, req.user.userId, req.params.emoji);
    res.json(result);
  } catch (err) { next(err); }
}

async function markChannelRead(req, res, next) {
  try {
    await pool.query(
      `INSERT INTO channel_reads (user_id, channel_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = NOW()`,
      [req.user.userId, req.params.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getMessages, editMessage, deleteMessage, toggleReaction, markChannelRead };
