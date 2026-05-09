const { Router } = require('express');
const { generateToken } = require('./voice.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { generateTokenSchema } = require('./voice.schema');

const router = Router();

router.post('/token', authenticate, validate(generateTokenSchema), generateToken);

module.exports = router;
