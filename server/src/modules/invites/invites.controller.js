// server/src/modules/invites/invites.controller.js
const invitesService = require('./invites.service');

async function createInvite(req, res, next) {
  try {
    const invite = await invitesService.createInvite(req.params.id, req.user.userId, req.body);
    res.status(201).json(invite);
  } catch (err) { next(err); }
}

async function previewInvite(req, res, next) {
  try {
    const preview = await invitesService.previewInvite(req.params.code);
    res.json(preview);
  } catch (err) { next(err); }
}

async function joinViaInvite(req, res, next) {
  try {
    const result = await invitesService.joinViaInvite(req.params.code, req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { createInvite, previewInvite, joinViaInvite };
