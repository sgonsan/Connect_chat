// server/src/config/env.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const required = (name) => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: required('DATABASE_URL'),
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
  JWT_SECRET: required('JWT_SECRET'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_TTL_DAYS: parseInt(process.env.JWT_REFRESH_TTL_DAYS || '7', 10),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  LIVEKIT_URL: process.env.LIVEKIT_URL || 'ws://localhost:7880',
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || 'secret',
};
