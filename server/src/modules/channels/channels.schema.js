// server/src/modules/channels/channels.schema.js
const { z } = require('zod');
const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  type: z.enum(['text', 'voice']).default('text'),
});
module.exports = { createChannelSchema };
