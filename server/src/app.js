// server/src/app.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const env = require('./config/env');

const authRoutes    = require('./modules/auth/auth.routes');
const usersRoutes   = require('./modules/users/users.routes');
const serversRoutes = require('./modules/servers/servers.routes');
const { serversRouter: channelServersRouter, channelsRouter } = require('./modules/channels/channels.routes');
const { channelsRouter: messagesChannelsRouter, messagesRouter } = require('./modules/messages/messages.routes');
const voiceRoutes = require('./modules/voice/voice.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

if (env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

app.use('/api/auth',                  authLimiter, authRoutes);
app.use('/api/users',                 usersRoutes);
app.use('/api/servers',               serversRoutes);
app.use('/api/servers/:id/channels',  channelServersRouter);
app.use('/api/channels',              channelsRouter);
app.use('/api/channels/:id/messages', messagesChannelsRouter);
app.use('/api/messages',              messagesRouter);
app.use('/api/voice',                 voiceRoutes);

app.use(errorHandler);

module.exports = app;
