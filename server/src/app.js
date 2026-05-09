// server/src/app.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const env = require('./config/env');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const serversRoutes = require('./modules/servers/servers.routes');
const { serversRouter: channelServersRouter, channelsRouter } = require('./modules/channels/channels.routes');
const { channelsRouter: messagesChannelsRouter, messagesRouter } = require('./modules/messages/messages.routes');
const voiceRoutes = require('./modules/voice/voice.routes');
const { serversInvitesRouter, invitesRouter } = require('./modules/invites/invites.routes');
const conversationsRouter = require('./modules/conversations/conversations.routes');

const app = express();

app.use(helmet({ hsts: false, crossOriginOpenerPolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Allow camera/microphone when served from this origin (useful when embedded/iframes)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  next();
});

if (env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/servers/:id/channels', channelServersRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/channels/:id/messages', messagesChannelsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/voice', voiceRoutes);
app.use('/api/servers/:id/invites', serversInvitesRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/conversations', conversationsRouter);

const distPath = path.join(__dirname, '../../client/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use(errorHandler);

module.exports = app;
