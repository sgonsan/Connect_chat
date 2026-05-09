// server/src/modules/invites/invites.routes.js
const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const validate     = require('../../middleware/validate');
const { createInviteSchema } = require('./invites.schema');
const ctrl = require('./invites.controller');

const serversInvitesRouter = Router({ mergeParams: true });
serversInvitesRouter.use(authenticate);
serversInvitesRouter.post('/', validate(createInviteSchema), ctrl.createInvite);

const invitesRouter = Router();
invitesRouter.get('/:code',       ctrl.previewInvite);
invitesRouter.post('/:code/join', authenticate, ctrl.joinViaInvite);

module.exports = { serversInvitesRouter, invitesRouter };
