// server/src/server.js
require('dotenv').config();
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const app = require('./app');
const { setupGateway } = require('./socket/gateway');
const env = require('./config/env');
const fs = require('fs');
const path = require('path');

// Prefer HTTPS in dev if certs are present at ../certs
const certDir = path.join(__dirname, '..', '..', 'certs');
let httpServer;
if (fs.existsSync(certDir)) {
  try {
    const files = fs.readdirSync(certDir);
    const keyFile = files.find(f => /key/i.test(f) && f.endsWith('.pem'));
    const certFile = files.find(f => !/key/i.test(f) && f.endsWith('.pem'));
    if (keyFile && certFile) {
      const key = fs.readFileSync(path.join(certDir, keyFile));
      const cert = fs.readFileSync(path.join(certDir, certFile));
      httpServer = https.createServer({ key, cert }, app);
      console.log('Starting HTTPS server using certs from', certDir);
    }
  } catch (err) {
    console.warn('Failed to load certs for HTTPS:', err.message);
  }
}
if (!httpServer) httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGIN,
    credentials: true,
  },
});

app.locals.io = io;
setupGateway(io);

httpServer.listen(env.PORT, () => {
  console.log(`${httpServer.constructor.name} running on port ${env.PORT}`);
});
