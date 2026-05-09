// server/src/modules/users/users.schema.js
const { z } = require('zod');

const updateUserSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar_url: z.string().url().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

module.exports = { updateUserSchema };
