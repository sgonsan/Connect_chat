const { z } = require('zod');

const generateTokenSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
});

module.exports = { generateTokenSchema };
