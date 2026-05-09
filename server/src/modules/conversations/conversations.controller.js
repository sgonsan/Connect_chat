// server/src/modules/conversations/conversations.controller.js
const svc = require('./conversations.service');

async function list(req, res, next) {
  try { res.json(await svc.list(req.user.userId)); }
  catch (err) { next(err); }
}

async function open(req, res, next) {
  try { res.json(await svc.open(req.user.userId, req.body.userId)); }
  catch (err) { next(err); }
}

async function getMessages(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    res.json(await svc.getMessages(req.params.id, req.user.userId, { before: req.query.before, limit }));
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try { await svc.markRead(req.params.id, req.user.userId); res.status(204).send(); }
  catch (err) { next(err); }
}

module.exports = { list, open, getMessages, markRead };
