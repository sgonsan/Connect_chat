import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Try to load local certs from ../certs for HTTPS dev (mkcert output)
const certDir = path.resolve(__dirname, '..', 'certs') || path.resolve(__dirname, '../certs');
let httpsConfig = false;
try {
  if (fs.existsSync(certDir)) {
    const files = fs.readdirSync(certDir);
    const keyFile = files.find(f => /key/i.test(f) && f.endsWith('.pem'));
    const certFile = files.find(f => !/key/i.test(f) && f.endsWith('.pem'));
    if (keyFile && certFile) {
      httpsConfig = {
        key: fs.readFileSync(path.join(certDir, keyFile)),
        cert: fs.readFileSync(path.join(certDir, certFile)),
      };
      console.log('Vite: using HTTPS certs from', certDir);
    }
  }
} catch (err) {
  console.warn('Vite: failed to read certs', err.message);
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: httpsConfig || false,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
