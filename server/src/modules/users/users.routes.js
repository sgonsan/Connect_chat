// server/src/modules/users/users.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { updateUserSchema } = require('./users.schema');
const ctrl = require('./users.controller');

const router = Router();

router.use(authenticate);
router.get('/me',   ctrl.getMe);
router.patch('/me', validate(updateUserSchema), ctrl.updateMe);

module.exports = router;
