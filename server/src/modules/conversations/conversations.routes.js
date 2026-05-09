// server/src/modules/conversations/conversations.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./conversations.controller');

const router = Router();
router.use(authenticate);

router.get('/',               ctrl.list);
router.post('/',              ctrl.open);
router.get('/:id/messages',   ctrl.getMessages);
router.patch('/:id/read',     ctrl.markRead);

module.exports = router;
