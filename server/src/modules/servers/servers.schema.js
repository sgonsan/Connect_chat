// server/src/modules/servers/servers.schema.js
const { z } = require('zod');

const createServerSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

const joinServerSchema = z.object({
  invite_code: z.string().uuid(),
});

module.exports = { createServerSchema, joinServerSchema };
