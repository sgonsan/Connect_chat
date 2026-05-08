const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('./env');

function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function generateRefreshToken() {
  return crypto.randomUUID();
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function refreshTokenExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + env.JWT_REFRESH_TTL_DAYS);
  return d;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
};
