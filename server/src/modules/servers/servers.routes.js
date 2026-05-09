// server/src/modules/servers/servers.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { createServerSchema, joinServerSchema } = require('./servers.schema');
const ctrl = require('./servers.controller');

const router = Router();
router.use(authenticate);

router.get('/',             ctrl.getMyServers);
router.post('/',            validate(createServerSchema), ctrl.createServer);
router.post('/join',        validate(joinServerSchema),   ctrl.joinServer);
router.get('/:id',          ctrl.getServerDetail);
router.delete('/:id',       ctrl.deleteServer);
router.delete('/:id/leave', ctrl.leaveServer);

module.exports = router;
