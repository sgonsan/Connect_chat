// server/src/modules/auth/auth.controller.js
const authService = require('./auth.service');
const env = require('../../config/env');

const COOKIE_NAME = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.NODE_ENV === 'production',
  maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

async function register(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);
    res.status(201).json({ user, accessToken });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);
    res.json({ user, accessToken });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies[COOKIE_NAME];
    if (!rawToken) return res.status(401).json({ error: 'No refresh token' });
    const { accessToken } = await authService.refresh(rawToken);
    res.json({ accessToken });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const rawToken = req.cookies[COOKIE_NAME];
    if (rawToken) await authService.logout(rawToken);
    res.clearCookie(COOKIE_NAME);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { register, login, refresh, logout };
