// server/src/modules/servers/servers.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const hasRole = require('../../middleware/hasRole');
const { createServerSchema, joinServerSchema, updateMemberRoleSchema } = require('./servers.schema');
const ctrl = require('./servers.controller');

const router = Router();
router.use(authenticate);

router.get('/',             ctrl.getMyServers);
router.post('/',            validate(createServerSchema), ctrl.createServer);
router.post('/join',        validate(joinServerSchema),   ctrl.joinServer);
router.get('/:id',          ctrl.getServerDetail);
router.get('/:id/unread',   ctrl.getUnreadCounts);
router.delete('/:id',       ctrl.deleteServer);
router.delete('/:id/leave', ctrl.leaveServer);

router.get('/:id/members',                   ctrl.getMembers);
router.patch('/:id/members/:userId/role',    hasRole('owner'), validate(updateMemberRoleSchema), ctrl.updateMemberRole);
router.delete('/:id/members/:userId',        hasRole('owner', 'moderator'), ctrl.kickMember);

module.exports = router;
