// server/src/modules/invites/invites.schema.js
const { z } = require('zod');

const createInviteSchema = z.object({
  expiresIn: z.number().int().positive().optional(),
  maxUses:   z.number().int().positive().optional(),
});

module.exports = { createInviteSchema };
