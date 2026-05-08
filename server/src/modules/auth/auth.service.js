const bcrypt = require('bcrypt');
const authRepo = require('./auth.repository');
const { signAccessToken, generateRefreshToken, hashToken, refreshTokenExpiresAt } = require('../../config/jwt');
const { createError } = require('../../middleware/errorHandler');

async function register({ username, email, password }) {
  const existing = await authRepo.findUserByEmail(email);
  if (existing) throw createError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await authRepo.createUser({ username, email, passwordHash });

  const { accessToken, refreshToken } = await _issueTokens(user.id);
  return { user, accessToken, refreshToken };
}

async function login({ email, password }) {
  const user = await authRepo.findUserByEmail(email);
  if (!user) throw createError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw createError(401, 'Invalid credentials');

  const { accessToken, refreshToken } = await _issueTokens(user.id);
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

async function refresh(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await authRepo.findActiveRefreshToken(tokenHash);
  if (!record) throw createError(401, 'Invalid or expired refresh token');

  const accessToken = signAccessToken({ userId: record.user_id });
  return { accessToken };
}

async function logout(rawToken) {
  const tokenHash = hashToken(rawToken);
  await authRepo.revokeRefreshToken(tokenHash);
}

async function _issueTokens(userId) {
  const accessToken = signAccessToken({ userId });
  const refreshToken = generateRefreshToken();
  await authRepo.createRefreshToken({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(),
  });
  return { accessToken, refreshToken };
}

module.exports = { register, login, refresh, logout };
