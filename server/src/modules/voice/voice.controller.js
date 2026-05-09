const { generateTokenSchema } = require('./voice.schema');
const { generateLiveKitToken } = require('./voice.service');
const { findChannelById } = require('../channels/channels.repository');
const pool = require('../../db');
const env = require('../../config/env');

async function generateToken(req, res, next) {
  try {
    const { channelId } = generateTokenSchema.parse(req.body);
    const userId = req.user.userId;

    const channel = await findChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (channel.type !== 'voice') {
      return res.status(400).json({ error: 'This channel is not a voice channel' });
    }

    const memberResult = await pool.query(
      'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
      [channel.server_id, userId]
    );
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this server' });
    }

    const token = await generateLiveKitToken(userId, channelId);
    res.json({ token, livekitUrl: env.LIVEKIT_URL });
  } catch (error) {
    next(error);
  }
}

module.exports = { generateToken };
