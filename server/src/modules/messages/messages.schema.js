// server/src/modules/messages/messages.schema.js
const { z } = require('zod');
const getMessagesSchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
module.exports = { getMessagesSchema };
