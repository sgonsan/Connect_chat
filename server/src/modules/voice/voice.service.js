const { AccessToken } = require('livekit-server-sdk');
const env = require('../../config/env');

async function generateLiveKitToken(userId, channelId) {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: String(userId),
    name: String(userId),
  });
  at.addGrant({
    room: String(channelId),
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  return at.toJwt();
}

module.exports = { generateLiveKitToken };
