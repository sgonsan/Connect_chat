// server/src/modules/auth/auth.routes.js
const { Router } = require('express');
const validate = require('../../middleware/validate');
const { registerSchema, loginSchema } = require('./auth.schema');
const ctrl = require('./auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login',    validate(loginSchema),    ctrl.login);
router.post('/refresh',                            ctrl.refresh);
router.post('/logout',                             ctrl.logout);

module.exports = router;
