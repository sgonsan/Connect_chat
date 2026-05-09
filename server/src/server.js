// server/src/server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { setupGateway } = require('./socket/gateway');
const env = require('./config/env');

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGIN,
    credentials: true,
  },
});

app.locals.io = io;
setupGateway(io);

httpServer.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
