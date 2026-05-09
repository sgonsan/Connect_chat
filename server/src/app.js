// server/src/app.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');
const env = require('./config/env');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const serversRoutes = require('./modules/servers/servers.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/servers', serversRoutes);

const { serversRouter: channelServersRouter, channelsRouter } = require('./modules/channels/channels.routes');
app.use('/api/servers/:id/channels', channelServersRouter);
app.use('/api/channels', channelsRouter);

app.use(errorHandler);

module.exports = app;
