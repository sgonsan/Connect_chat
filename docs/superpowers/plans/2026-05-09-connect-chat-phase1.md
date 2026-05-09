# Connect Chat — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el backend completo de Connect Chat (auth JWT, servidores, canales, mensajería persistente, Socket.IO) y un frontend React mínimo para probarlo.

**Architecture:** Monolito modular Node.js + Express + Socket.IO. REST API y gateway WebSocket comparten la misma capa Service → Repository → PostgreSQL. Auth con JWT de corta vida + refresh token en cookie HttpOnly.

**Tech Stack:** Node.js 20, Express 4, Socket.IO 4, PostgreSQL 16, pg, bcrypt, jsonwebtoken, zod, helmet, express-rate-limit, cors, cookie-parser, dotenv, Jest, supertest | React 18, Vite, Tailwind CSS.

---

## Mapa de archivos

```
connect-chat/
├── docker-compose.yml
├── .env.example
├── server/
│   ├── package.json
│   ├── jest.config.js
│   └── src/
│       ├── app.js                          # Express app (sin listen)
│       ├── server.js                       # HTTP server + Socket.IO + listen
│       ├── config/
│       │   ├── env.js                      # valida y exporta vars de entorno
│       │   └── jwt.js                      # sign/verify helpers
│       ├── db/
│       │   ├── index.js                    # re-exporta pool
│       │   ├── migrate.js                  # runner de migraciones
│       │   └── migrations/
│       │       └── 001_init.sql
│       ├── middleware/
│       │   ├── validate.js                 # zod wrapper para req.body
│       │   ├── authenticate.js             # verifica JWT → req.user
│       │   ├── isMember.js                 # verifica membresía en servidor
│       │   ├── isOwner.js                  # verifica que req.user sea owner
│       │   ├── rateLimiter.js              # instancias express-rate-limit
│       │   └── errorHandler.js             # global error handler
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── auth.schema.js          # zod schemas
│       │   │   ├── auth.repository.js      # queries SQL
│       │   │   ├── auth.service.js         # lógica (hash, tokens)
│       │   │   ├── auth.controller.js
│       │   │   └── auth.routes.js
│       │   ├── users/
│       │   │   ├── users.schema.js
│       │   │   ├── users.repository.js
│       │   │   ├── users.service.js
│       │   │   ├── users.controller.js
│       │   │   └── users.routes.js
│       │   ├── servers/
│       │   │   ├── servers.schema.js
│       │   │   ├── servers.repository.js
│       │   │   ├── servers.service.js
│       │   │   ├── servers.controller.js
│       │   │   └── servers.routes.js
│       │   ├── channels/
│       │   │   ├── channels.schema.js
│       │   │   ├── channels.repository.js
│       │   │   ├── channels.service.js
│       │   │   ├── channels.controller.js
│       │   │   └── channels.routes.js
│       │   └── messages/
│       │       ├── messages.schema.js
│       │       ├── messages.repository.js
│       │       ├── messages.service.js
│       │       ├── messages.controller.js
│       │       └── messages.routes.js
│       └── socket/
│           ├── gateway.js                  # Socket.IO setup + auth middleware
│           └── handlers/
│               ├── channel.handler.js      # channel:join, channel:leave
│               └── message.handler.js      # message:send, message:delete
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── socket.js                       # instancia Socket.IO client (singleton)
        ├── context/
        │   ├── AuthContext.jsx
        │   └── SocketContext.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── AppPage.jsx
        └── components/
            ├── ServerList.jsx
            ├── ChannelList.jsx
            ├── ChatArea.jsx
            └── MessageInput.jsx
```

---

## Task 1: Scaffold del proyecto

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/jest.config.js`
- Create: `client/package.json`

- [ ] **Step 1: Crear estructura de directorios**

```bash
mkdir -p connect-chat/{server/src/{config,db/migrations,middleware,modules/{auth,users,servers,channels,messages},socket/handlers},client/src/{context,pages,components}}
cd connect-chat
```

- [ ] **Step 2: Crear `docker-compose.yml`**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: connectchat
      POSTGRES_PASSWORD: connectchat
      POSTGRES_DB: connectchat
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  postgres_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: connectchat
      POSTGRES_PASSWORD: connectchat
      POSTGRES_DB: connectchat_test
    ports:
      - "5433:5432"

volumes:
  pgdata:
```

- [ ] **Step 3: Crear `.env.example`**

```bash
# .env.example
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://connectchat:connectchat@localhost:5432/connectchat
DATABASE_URL_TEST=postgresql://connectchat:connectchat@localhost:5433/connectchat_test

JWT_SECRET=replace_with_64_char_hex_secret_minimum_256_bits
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=7

ALLOWED_ORIGIN=http://localhost:5173
```

Copiar a `.env` y ajustar si hace falta:
```bash
cp .env.example .env
```

- [ ] **Step 4: Crear `server/package.json`**

```json
{
  "name": "connect-chat-server",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "src/server.js",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "migrate": "node src/db/migrate.js",
    "test": "jest --runInBand",
    "test:watch": "jest --runInBand --watch"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.4",
    "express": "^4.18.3",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "socket.io": "^4.7.4",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 5: Crear `server/jest.config.js`**

```js
// server/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  forceExit: true,
};
```

- [ ] **Step 6: Instalar dependencias del servidor**

```bash
cd server && npm install
```

Expected: `node_modules/` creado sin errores.

- [ ] **Step 7: Crear `client/package.json`**

```json
{
  "name": "connect-chat-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3",
    "socket.io-client": "^4.7.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.1.4"
  }
}
```

- [ ] **Step 8: Instalar dependencias del cliente**

```bash
cd ../client && npm install
```

- [ ] **Step 9: Levantar PostgreSQL**

```bash
cd .. && docker compose up -d
```

Expected: contenedores `postgres` y `postgres_test` corriendo.
Verificar: `docker compose ps` → ambos en estado `running`.

- [ ] **Step 10: Commit**

```bash
git init
echo "node_modules/\n.env\n.superpowers/" > .gitignore
git add .
git commit -m "chore: project scaffold, docker-compose, dependencies"
```

---

## Task 2: Database — migración y pool

**Files:**
- Create: `server/src/db/migrations/001_init.sql`
- Create: `server/src/db/migrate.js`
- Create: `server/src/db/index.js`
- Create: `server/src/config/env.js`

- [ ] **Step 1: Crear `server/src/config/env.js`**

```js
// server/src/config/env.js
require('dotenv').config();

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
};
```

- [ ] **Step 2: Crear `server/src/db/migrations/001_init.sql`**

```sql
-- server/src/db/migrations/001_init.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    VARCHAR(500),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  owner_id    UUID NOT NULL REFERENCES users(id),
  invite_code UUID UNIQUE  DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS server_members (
  user_id   UUID REFERENCES users(id)   ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id),
  CONSTRAINT role_check CHECK (role IN ('owner', 'member'))
);

CREATE TABLE IF NOT EXISTS channels (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  content    VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_members_user_server
  ON server_members(user_id, server_id);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON refresh_tokens(token_hash);
```

- [ ] **Step 3: Crear `server/src/db/migrate.js`**

```js
// server/src/db/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const url = process.env.MIGRATE_TEST === '1'
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

async function migrate() {
  const pool = new Pool({ connectionString: url });
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log('Migrations complete.');
}

migrate().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Crear `server/src/db/index.js`**

```js
// server/src/db/index.js
const { Pool } = require('pg');
const env = require('../config/env');

const connectionString = env.NODE_ENV === 'test'
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

const pool = new Pool({ connectionString });

module.exports = pool;
```

- [ ] **Step 5: Ejecutar migración en DB de desarrollo**

```bash
cd server && node src/db/migrate.js
```

Expected output:
```
Running migration: 001_init.sql
Migrations complete.
```

- [ ] **Step 6: Ejecutar migración en DB de test**

```bash
MIGRATE_TEST=1 node src/db/migrate.js
```

Expected: mismo output, en puerto 5433.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: database migrations, pool, env config"
```

---

## Task 3: Config — JWT helpers

**Files:**
- Create: `server/src/config/jwt.js`

- [ ] **Step 1: Crear `server/src/config/jwt.js`**

```js
// server/src/config/jwt.js
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
```

- [ ] **Step 2: Verificar manualmente que sign/verify funcionan**

```bash
node -e "
const j = require('./src/config/jwt');
const tok = j.signAccessToken({ userId: 'abc', username: 'test' });
console.log('token:', tok.substring(0, 30), '...');
const dec = j.verifyAccessToken(tok);
console.log('decoded userId:', dec.userId);
"
```

Expected: imprime el token y `decoded userId: abc`.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: jwt sign/verify/hash helpers"
```

---

## Task 4: Middleware base — validate + errorHandler

**Files:**
- Create: `server/src/middleware/validate.js`
- Create: `server/src/middleware/errorHandler.js`

- [ ] **Step 1: Crear `server/src/middleware/validate.js`**

```js
// server/src/middleware/validate.js
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
```

- [ ] **Step 2: Crear `server/src/middleware/errorHandler.js`**

```js
// server/src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, createError };
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: validate middleware and error handler"
```

---

## Task 5: Auth — schema, repository, service

**Files:**
- Create: `server/src/modules/auth/auth.schema.js`
- Create: `server/src/modules/auth/auth.repository.js`
- Create: `server/src/modules/auth/auth.service.js`
- Create: `server/src/__tests__/auth/auth.service.test.js`

- [ ] **Step 1: Crear `server/src/modules/auth/auth.schema.js`**

```js
// server/src/modules/auth/auth.schema.js
const { z } = require('zod');

const registerSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

module.exports = { registerSchema, loginSchema };
```

- [ ] **Step 2: Crear `server/src/modules/auth/auth.repository.js`**

```js
// server/src/modules/auth/auth.repository.js
const pool = require('../../db');

async function createUser({ username, email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, avatar_url, created_at`,
    [username, email, passwordHash]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createRefreshToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findActiveRefreshToken(tokenHash) {
  const { rows } = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findActiveRefreshToken,
  revokeRefreshToken,
};
```

- [ ] **Step 3: Escribir el test fallido para auth.service**

Crear `server/src/__tests__/auth/auth.service.test.js`:

```js
// server/src/__tests__/auth/auth.service.test.js
jest.mock('../../modules/auth/auth.repository');

const authRepo = require('../../modules/auth/auth.repository');
const authService = require('../../modules/auth/auth.service');

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hashes the password before storing', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);
    authRepo.createUser.mockResolvedValue({
      id: 'user-1', username: 'alice', email: 'alice@test.com',
    });
    authRepo.createRefreshToken.mockResolvedValue();

    const result = await authService.register({
      username: 'alice', email: 'alice@test.com', password: 'secret123',
    });

    expect(authRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.not.stringContaining('secret123'),
      })
    );
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
  });

  it('throws 409 if email already exists', async () => {
    authRepo.findUserByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      authService.register({ username: 'bob', email: 'taken@test.com', password: 'secret123' })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns tokens on valid credentials', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('mypassword', 1);
    authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1', username: 'alice', email: 'alice@test.com',
      password_hash: hash,
    });
    authRepo.createRefreshToken.mockResolvedValue();

    const result = await authService.login({ email: 'alice@test.com', password: 'mypassword' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('throws 401 on wrong password', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('correctpassword', 1);
    authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1', password_hash: hash,
    });

    await expect(
      authService.login({ email: 'alice@test.com', password: 'wrongpassword' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 if user not found', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'any' })
    ).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 4: Ejecutar el test para verificar que falla**

```bash
cd server && npx jest --testPathPattern="auth.service" --runInBand
```

Expected: FAIL — `Cannot find module '../../modules/auth/auth.service'`.

- [ ] **Step 5: Crear `server/src/modules/auth/auth.service.js`**

```js
// server/src/modules/auth/auth.service.js
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
```

- [ ] **Step 6: Ejecutar el test para verificar que pasa**

```bash
npx jest --testPathPattern="auth.service" --runInBand
```

Expected: PASS — 5 tests pasan.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: auth schema, repository, service + unit tests"
```

---

## Task 6: Auth — controller, routes

**Files:**
- Create: `server/src/modules/auth/auth.controller.js`
- Create: `server/src/modules/auth/auth.routes.js`
- Create: `server/src/__tests__/auth/auth.integration.test.js`

- [ ] **Step 1: Crear `server/src/modules/auth/auth.controller.js`**

```js
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
```

- [ ] **Step 2: Crear `server/src/modules/auth/auth.routes.js`**

```js
// server/src/modules/auth/auth.routes.js
const { Router } = require('express');
const validate = require('../../middleware/validate');
const { registerSchema, loginSchema } = require('./auth.schema');
const ctrl = require('./auth.controller');

const router = Router();

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login',    validate(loginSchema),    ctrl.login);
router.post('/refresh',                            ctrl.refresh);
router.post('/logout',                             ctrl.logout);

module.exports = router;
```

- [ ] **Step 3: Crear `server/src/app.js` temporal para tests de integración**

```js
// server/src/app.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');
const env = require('./config/env');

const authRoutes = require('./modules/auth/auth.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 4: Escribir test de integración de auth**

Crear `server/src/__tests__/auth/auth.integration.test.js`:

```js
// server/src/__tests__/auth/auth.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens CASCADE');
});

describe('POST /api/auth/register', () => {
  it('creates user and returns access token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@test.com' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 on duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns access token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new access token using refresh cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh token cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 5: Ejecutar tests de integración de auth**

Asegurarse de que `NODE_ENV=test` esté configurado para apuntar a la DB de test:

```bash
NODE_ENV=test npx jest --testPathPattern="auth.integration" --runInBand
```

Expected: PASS — 7 tests pasan.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: auth controller, routes, integration tests"
```

---

## Task 7: authenticate middleware

**Files:**
- Create: `server/src/middleware/authenticate.js`
- Create: `server/src/__tests__/middleware/authenticate.test.js`

- [ ] **Step 1: Escribir el test fallido**

```js
// server/src/__tests__/middleware/authenticate.test.js
const authenticate = require('../../middleware/authenticate');
const { signAccessToken } = require('../../config/jwt');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  it('calls next and attaches req.user on valid token', () => {
    const token = signAccessToken({ userId: 'user-1' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ userId: 'user-1' });
  });

  it('returns 401 when no token provided', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

```bash
npx jest --testPathPattern="authenticate" --runInBand
```

Expected: FAIL — `Cannot find module '../../middleware/authenticate'`.

- [ ] **Step 3: Crear `server/src/middleware/authenticate.js`**

```js
// server/src/middleware/authenticate.js
const { verifyAccessToken } = require('../config/jwt');

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = auth.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

```bash
npx jest --testPathPattern="authenticate" --runInBand
```

Expected: PASS — 3 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: authenticate middleware + unit tests"
```

---

## Task 8: Users module

**Files:**
- Create: `server/src/modules/users/users.schema.js`
- Create: `server/src/modules/users/users.repository.js`
- Create: `server/src/modules/users/users.service.js`
- Create: `server/src/modules/users/users.controller.js`
- Create: `server/src/modules/users/users.routes.js`
- Create: `server/src/__tests__/users/users.integration.test.js`

- [ ] **Step 1: Crear schema, repository y service**

```js
// server/src/modules/users/users.schema.js
const { z } = require('zod');

const updateUserSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar_url: z.string().url().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

module.exports = { updateUserSchema };
```

```js
// server/src/modules/users/users.repository.js
const pool = require('../../db');

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function updateUser(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE users SET ${set} WHERE id = $1
     RETURNING id, username, email, avatar_url, created_at`,
    [id, ...values]
  );
  return rows[0] || null;
}

module.exports = { findById, updateUser };
```

```js
// server/src/modules/users/users.service.js
const usersRepo = require('./users.repository');
const { createError } = require('../../middleware/errorHandler');

async function getMe(userId) {
  const user = await usersRepo.findById(userId);
  if (!user) throw createError(404, 'User not found');
  return user;
}

async function updateMe(userId, fields) {
  const user = await usersRepo.updateUser(userId, fields);
  if (!user) throw createError(404, 'User not found');
  return user;
}

module.exports = { getMe, updateMe };
```

- [ ] **Step 2: Crear controller y routes**

```js
// server/src/modules/users/users.controller.js
const usersService = require('./users.service');

async function getMe(req, res, next) {
  try {
    const user = await usersService.getMe(req.user.userId);
    res.json(user);
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await usersService.updateMe(req.user.userId, req.body);
    res.json(user);
  } catch (err) { next(err); }
}

module.exports = { getMe, updateMe };
```

```js
// server/src/modules/users/users.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { updateUserSchema } = require('./users.schema');
const ctrl = require('./users.controller');

const router = Router();

router.use(authenticate);
router.get('/me',   ctrl.getMe);
router.patch('/me', validate(updateUserSchema), ctrl.updateMe);

module.exports = router;
```

- [ ] **Step 3: Escribir y ejecutar test de integración**

```js
// server/src/__tests__/users/users.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let token;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens CASCADE');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'tester', email: 'tester@test.com', password: 'password123' });
  token = res.body.accessToken;
});

describe('GET /api/users/me', () => {
  it('returns the authenticated user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'tester', email: 'tester@test.com' });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the username', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'tester_updated' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('tester_updated');
  });
});
```

Agregar `users.routes` a `app.js` (modificar `src/app.js`):

```js
// Agregar después de authRoutes
const usersRoutes = require('./modules/users/users.routes');
app.use('/api/users', usersRoutes);
```

```bash
NODE_ENV=test npx jest --testPathPattern="users.integration" --runInBand
```

Expected: PASS — 3 tests pasan.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: users module (get me, update me) + integration tests"
```

---

## Task 9: Servers module

**Files:**
- Create: `server/src/modules/servers/servers.schema.js`
- Create: `server/src/modules/servers/servers.repository.js`
- Create: `server/src/modules/servers/servers.service.js`
- Create: `server/src/modules/servers/servers.controller.js`
- Create: `server/src/modules/servers/servers.routes.js`
- Create: `server/src/__tests__/servers/servers.integration.test.js`

- [ ] **Step 1: Schema**

```js
// server/src/modules/servers/servers.schema.js
const { z } = require('zod');

const createServerSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

const joinServerSchema = z.object({
  invite_code: z.string().uuid(),
});

module.exports = { createServerSchema, joinServerSchema };
```

- [ ] **Step 2: Repository**

```js
// server/src/modules/servers/servers.repository.js
const pool = require('../../db');

async function createServer({ name, description, ownerId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO servers (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, ownerId]
    );
    const server = rows[0];
    await client.query(
      `INSERT INTO server_members (user_id, server_id, role)
       VALUES ($1, $2, 'owner')`,
      [ownerId, server.id]
    );
    await client.query('COMMIT');
    return server;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findServersByUser(userId) {
  const { rows } = await pool.query(
    `SELECT s.* FROM servers s
     JOIN server_members sm ON sm.server_id = s.id
     WHERE sm.user_id = $1
     ORDER BY s.created_at ASC`,
    [userId]
  );
  return rows;
}

async function findServerById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM servers WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findServerByInviteCode(inviteCode) {
  const { rows } = await pool.query(
    'SELECT * FROM servers WHERE invite_code = $1',
    [inviteCode]
  );
  return rows[0] || null;
}

async function deleteServer(id) {
  await pool.query('DELETE FROM servers WHERE id = $1', [id]);
}

async function addMember(userId, serverId) {
  await pool.query(
    `INSERT INTO server_members (user_id, server_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [userId, serverId]
  );
}

async function removeMember(userId, serverId) {
  await pool.query(
    'DELETE FROM server_members WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  );
}

async function getMembership(userId, serverId) {
  const { rows } = await pool.query(
    'SELECT * FROM server_members WHERE user_id = $1 AND server_id = $2',
    [userId, serverId]
  );
  return rows[0] || null;
}

async function getServerWithChannels(serverId) {
  const serverRes = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
  const server = serverRes.rows[0];
  if (!server) return null;

  const channelsRes = await pool.query(
    'SELECT * FROM channels WHERE server_id = $1 ORDER BY created_at ASC',
    [serverId]
  );
  return { ...server, channels: channelsRes.rows };
}

module.exports = {
  createServer, findServersByUser, findServerById,
  findServerByInviteCode, deleteServer, addMember,
  removeMember, getMembership, getServerWithChannels,
};
```

- [ ] **Step 3: Service**

```js
// server/src/modules/servers/servers.service.js
const serversRepo = require('./servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createServer({ name, description }, ownerId) {
  return serversRepo.createServer({ name, description, ownerId });
}

async function getMyServers(userId) {
  return serversRepo.findServersByUser(userId);
}

async function getServerDetail(serverId, userId) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return serversRepo.getServerWithChannels(serverId);
}

async function deleteServer(serverId, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can delete this server');
  await serversRepo.deleteServer(serverId);
}

async function joinServer(inviteCode, userId) {
  const server = await serversRepo.findServerByInviteCode(inviteCode);
  if (!server) throw createError(404, 'Invalid invite code');

  const existing = await serversRepo.getMembership(userId, server.id);
  if (existing) throw createError(409, 'Already a member');

  await serversRepo.addMember(userId, server.id);
  return server;
}

async function leaveServer(serverId, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id === userId) throw createError(400, 'Owner cannot leave — delete the server instead');

  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(404, 'Not a member');

  await serversRepo.removeMember(userId, serverId);
}

module.exports = { createServer, getMyServers, getServerDetail, deleteServer, joinServer, leaveServer };
```

- [ ] **Step 4: Controller y routes**

```js
// server/src/modules/servers/servers.controller.js
const serversService = require('./servers.service');

async function createServer(req, res, next) {
  try {
    const server = await serversService.createServer(req.body, req.user.userId);
    res.status(201).json(server);
  } catch (err) { next(err); }
}

async function getMyServers(req, res, next) {
  try {
    res.json(await serversService.getMyServers(req.user.userId));
  } catch (err) { next(err); }
}

async function getServerDetail(req, res, next) {
  try {
    const server = await serversService.getServerDetail(req.params.id, req.user.userId);
    res.json(server);
  } catch (err) { next(err); }
}

async function deleteServer(req, res, next) {
  try {
    await serversService.deleteServer(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function joinServer(req, res, next) {
  try {
    const server = await serversService.joinServer(req.body.invite_code, req.user.userId);
    res.json(server);
  } catch (err) { next(err); }
}

async function leaveServer(req, res, next) {
  try {
    await serversService.leaveServer(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { createServer, getMyServers, getServerDetail, deleteServer, joinServer, leaveServer };
```

```js
// server/src/modules/servers/servers.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { createServerSchema, joinServerSchema } = require('./servers.schema');
const ctrl = require('./servers.controller');

const router = Router();
router.use(authenticate);

router.get('/',          ctrl.getMyServers);
router.post('/',         validate(createServerSchema), ctrl.createServer);
router.post('/join',     validate(joinServerSchema),   ctrl.joinServer);
router.get('/:id',       ctrl.getServerDetail);
router.delete('/:id',    ctrl.deleteServer);
router.delete('/:id/leave', ctrl.leaveServer);

module.exports = router;
```

- [ ] **Step 5: Escribir y ejecutar test de integración de servers**

```js
// server/src/__tests__/servers/servers.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenAlice, tokenBob, serverId, inviteCode;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resA = await request(app).post('/api/auth/register')
    .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });
  tokenAlice = resA.body.accessToken;

  const resB = await request(app).post('/api/auth/register')
    .send({ username: 'bob', email: 'bob@test.com', password: 'password123' });
  tokenBob = resB.body.accessToken;
});

describe('POST /api/servers', () => {
  it('creates a server and makes creator owner', async () => {
    const res = await request(app).post('/api/servers')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ name: 'Test Server' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Server');
    serverId = res.body.id;
    inviteCode = res.body.invite_code;
  });
});

describe('GET /api/servers/:id', () => {
  it('returns server with channels for members', async () => {
    const res = await request(app).get(`/api/servers/${serverId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('channels');
  });

  it('returns 403 for non-members', async () => {
    const res = await request(app).get(`/api/servers/${serverId}`)
      .set('Authorization', `Bearer ${tokenBob}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/servers/join', () => {
  it('lets bob join with invite code', async () => {
    const res = await request(app).post('/api/servers/join')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ invite_code: inviteCode });
    expect(res.status).toBe(200);
  });

  it('returns 409 if already member', async () => {
    const res = await request(app).post('/api/servers/join')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ invite_code: inviteCode });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/servers/:id/leave', () => {
  it('lets bob leave the server', async () => {
    const res = await request(app).delete(`/api/servers/${serverId}/leave`)
      .set('Authorization', `Bearer ${tokenBob}`);
    expect(res.status).toBe(204);
  });

  it('prevents owner from leaving', async () => {
    const res = await request(app).delete(`/api/servers/${serverId}/leave`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    expect(res.status).toBe(400);
  });
});
```

Agregar `servers.routes` a `app.js`:
```js
const serversRoutes = require('./modules/servers/servers.routes');
app.use('/api/servers', serversRoutes);
```

```bash
NODE_ENV=test npx jest --testPathPattern="servers.integration" --runInBand
```

Expected: PASS — 6 tests pasan.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: servers module (CRUD, join, leave) + integration tests"
```

---

## Task 10: Membership middleware

**Files:**
- Create: `server/src/middleware/isMember.js`
- Create: `server/src/middleware/isOwner.js`

- [ ] **Step 1: Crear `server/src/middleware/isMember.js`**

Este middleware resuelve `req.params.id` o `req.params.serverId` como ID del servidor, y verifica membresía.

```js
// server/src/middleware/isMember.js
const serversRepo = require('../modules/servers/servers.repository');

function isMember(serverIdParam = 'id') {
  return async (req, res, next) => {
    const serverId = req.params[serverIdParam];
    const membership = await serversRepo.getMembership(req.user.userId, serverId);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this server' });
    }
    req.membership = membership;
    next();
  };
}

module.exports = isMember;
```

- [ ] **Step 2: Crear `server/src/middleware/isOwner.js`**

```js
// server/src/middleware/isOwner.js
const serversRepo = require('../modules/servers/servers.repository');

function isOwner(serverIdParam = 'id') {
  return async (req, res, next) => {
    const serverId = req.params[serverIdParam];
    const server = await serversRepo.findServerById(serverId);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.owner_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the server owner can do this' });
    }
    req.server = server;
    next();
  };
}

module.exports = isOwner;
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: isMember and isOwner authorization middleware"
```

---

## Task 11: Channels module

**Files:**
- Create: `server/src/modules/channels/channels.schema.js`
- Create: `server/src/modules/channels/channels.repository.js`
- Create: `server/src/modules/channels/channels.service.js`
- Create: `server/src/modules/channels/channels.controller.js`
- Create: `server/src/modules/channels/channels.routes.js`
- Create: `server/src/__tests__/channels/channels.integration.test.js`

- [ ] **Step 1: Schema, repository, service**

```js
// server/src/modules/channels/channels.schema.js
const { z } = require('zod');
const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
});
module.exports = { createChannelSchema };
```

```js
// server/src/modules/channels/channels.repository.js
const pool = require('../../db');

async function createChannel(serverId, name) {
  const { rows } = await pool.query(
    'INSERT INTO channels (server_id, name) VALUES ($1, $2) RETURNING *',
    [serverId, name]
  );
  return rows[0];
}

async function findChannelById(id) {
  const { rows } = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
  return rows[0] || null;
}

async function deleteChannel(id) {
  await pool.query('DELETE FROM channels WHERE id = $1', [id]);
}

module.exports = { createChannel, findChannelById, deleteChannel };
```

```js
// server/src/modules/channels/channels.service.js
const channelsRepo = require('./channels.repository');
const serversRepo = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createChannel(serverId, name, userId) {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can create channels');
  return channelsRepo.createChannel(serverId, name);
}

async function deleteChannel(channelId, userId) {
  const channel = await channelsRepo.findChannelById(channelId);
  if (!channel) throw createError(404, 'Channel not found');
  const server = await serversRepo.findServerById(channel.server_id);
  if (server.owner_id !== userId) throw createError(403, 'Only the owner can delete channels');
  await channelsRepo.deleteChannel(channelId);
}

module.exports = { createChannel, deleteChannel };
```

- [ ] **Step 2: Controller y routes**

```js
// server/src/modules/channels/channels.controller.js
const channelsService = require('./channels.service');

async function createChannel(req, res, next) {
  try {
    const channel = await channelsService.createChannel(req.params.id, req.body.name, req.user.userId);
    res.status(201).json(channel);
  } catch (err) { next(err); }
}

async function deleteChannel(req, res, next) {
  try {
    await channelsService.deleteChannel(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { createChannel, deleteChannel };
```

```js
// server/src/modules/channels/channels.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { createChannelSchema } = require('./channels.schema');
const ctrl = require('./channels.controller');

const serversRouter = Router({ mergeParams: true });
serversRouter.use(authenticate);
serversRouter.post('/', validate(createChannelSchema), ctrl.createChannel);

const channelsRouter = Router();
channelsRouter.use(authenticate);
channelsRouter.delete('/:id', ctrl.deleteChannel);

module.exports = { serversRouter, channelsRouter };
```

- [ ] **Step 3: Agregar routes a `app.js`**

```js
// En app.js, agregar:
const { serversRouter: channelServersRouter, channelsRouter } = require('./modules/channels/channels.routes');
app.use('/api/servers/:id/channels', channelServersRouter);
app.use('/api/channels', channelsRouter);
```

- [ ] **Step 4: Test de integración**

```js
// server/src/__tests__/channels/channels.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenOwner, tokenMember, serverId, channelId;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resO = await request(app).post('/api/auth/register')
    .send({ username: 'owner', email: 'owner@test.com', password: 'password123' });
  tokenOwner = resO.body.accessToken;

  const resM = await request(app).post('/api/auth/register')
    .send({ username: 'member', email: 'member@test.com', password: 'password123' });
  tokenMember = resM.body.accessToken;

  const resS = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'Test Server' });
  serverId = resS.body.id;
  const inviteCode = resS.body.invite_code;

  await request(app).post('/api/servers/join')
    .set('Authorization', `Bearer ${tokenMember}`)
    .send({ invite_code: inviteCode });
});

describe('POST /api/servers/:id/channels', () => {
  it('owner can create a channel', async () => {
    const res = await request(app)
      .post(`/api/servers/${serverId}/channels`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'general' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('general');
    channelId = res.body.id;
  });

  it('member cannot create a channel', async () => {
    const res = await request(app)
      .post(`/api/servers/${serverId}/channels`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'random' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/channels/:id', () => {
  it('owner can delete a channel', async () => {
    const res = await request(app)
      .delete(`/api/channels/${channelId}`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(204);
  });
});
```

```bash
NODE_ENV=test npx jest --testPathPattern="channels.integration" --runInBand
```

Expected: PASS — 3 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: channels module (create, delete) + integration tests"
```

---

## Task 12: Messages module

**Files:**
- Create: `server/src/modules/messages/messages.schema.js`
- Create: `server/src/modules/messages/messages.repository.js`
- Create: `server/src/modules/messages/messages.service.js`
- Create: `server/src/modules/messages/messages.controller.js`
- Create: `server/src/modules/messages/messages.routes.js`
- Create: `server/src/__tests__/messages/messages.integration.test.js`

- [ ] **Step 1: Schema, repository, service**

```js
// server/src/modules/messages/messages.schema.js
const { z } = require('zod');
const getMessagesSchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
module.exports = { getMessagesSchema };
```

```js
// server/src/modules/messages/messages.repository.js
const pool = require('../../db');

async function createMessage({ channelId, userId, content }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (channel_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, channel_id, user_id, content, created_at, edited_at`,
    [channelId, userId, content]
  );
  return rows[0];
}

async function getMessages(channelId, { before, limit }) {
  let query = `
    SELECT m.id, m.channel_id, m.content, m.created_at, m.edited_at,
           json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url) AS user
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = $1
  `;
  const params = [channelId];

  if (before) {
    params.push(before);
    query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
  }

  params.push(limit);
  query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

  const { rows } = await pool.query(query, params);
  return rows.reverse();
}

async function findMessageById(id) {
  const { rows } = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return rows[0] || null;
}

async function deleteMessage(id) {
  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
}

async function getChannelServerId(channelId) {
  const { rows } = await pool.query(
    'SELECT server_id FROM channels WHERE id = $1',
    [channelId]
  );
  return rows[0]?.server_id || null;
}

module.exports = { createMessage, getMessages, findMessageById, deleteMessage, getChannelServerId };
```

```js
// server/src/modules/messages/messages.service.js
const messagesRepo = require('./messages.repository');
const serversRepo = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function getMessages(channelId, query, userId) {
  const serverId = await messagesRepo.getChannelServerId(channelId);
  if (!serverId) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return messagesRepo.getMessages(channelId, query);
}

async function createMessage({ channelId, userId, content }) {
  const serverId = await messagesRepo.getChannelServerId(channelId);
  if (!serverId) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return messagesRepo.createMessage({ channelId, userId, content });
}

async function deleteMessage(messageId, userId) {
  const message = await messagesRepo.findMessageById(messageId);
  if (!message) throw createError(404, 'Message not found');
  if (message.user_id !== userId) throw createError(403, 'Cannot delete another user\'s message');
  await messagesRepo.deleteMessage(messageId);
  return { messageId, channelId: message.channel_id };
}

module.exports = { getMessages, createMessage, deleteMessage };
```

- [ ] **Step 2: Controller y routes**

```js
// server/src/modules/messages/messages.controller.js
const messagesService = require('./messages.service');
const { getMessagesSchema } = require('./messages.schema');

async function getMessages(req, res, next) {
  try {
    const query = getMessagesSchema.parse(req.query);
    const messages = await messagesService.getMessages(req.params.id, query, req.user.userId);
    res.json(messages);
  } catch (err) { next(err); }
}

async function deleteMessage(req, res, next) {
  try {
    await messagesService.deleteMessage(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getMessages, deleteMessage };
```

```js
// server/src/modules/messages/messages.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./messages.controller');

const channelsRouter = Router({ mergeParams: true });
channelsRouter.use(authenticate);
channelsRouter.get('/', ctrl.getMessages);

const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.delete('/:id', ctrl.deleteMessage);

module.exports = { channelsRouter, messagesRouter };
```

- [ ] **Step 3: Agregar routes a `app.js`**

```js
const { channelsRouter: messagesChannelsRouter, messagesRouter } = require('./modules/messages/messages.routes');
app.use('/api/channels/:id/messages', messagesChannelsRouter);
app.use('/api/messages', messagesRouter);
```

- [ ] **Step 4: Test de integración**

```js
// server/src/__tests__/messages/messages.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenOwner, tokenOther, channelId, messageId;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resO = await request(app).post('/api/auth/register')
    .send({ username: 'msgowner', email: 'msgowner@test.com', password: 'password123' });
  tokenOwner = resO.body.accessToken;

  const resOther = await request(app).post('/api/auth/register')
    .send({ username: 'other', email: 'other@test.com', password: 'password123' });
  tokenOther = resOther.body.accessToken;

  const resS = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'Msg Server' });
  const serverId = resS.body.id;

  const resC = await request(app).post(`/api/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'general' });
  channelId = resC.body.id;
});

describe('GET /api/channels/:id/messages', () => {
  it('returns message history for members', async () => {
    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 403 for non-members', async () => {
    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${tokenOther}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/messages/:id', () => {
  beforeAll(async () => {
    const messagesRepo = require('../../modules/messages/messages.repository');
    const msg = await messagesRepo.createMessage({
      channelId,
      userId: (await pool.query("SELECT id FROM users WHERE username='msgowner'")).rows[0].id,
      content: 'hello',
    });
    messageId = msg.id;
  });

  it('owner can delete their own message', async () => {
    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(204);
  });
});
```

```bash
NODE_ENV=test npx jest --testPathPattern="messages.integration" --runInBand
```

Expected: PASS — 3 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: messages module (history, delete) + integration tests"
```

---

## Task 13: Rate limiting y security headers

**Files:**
- Create: `server/src/middleware/rateLimiter.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Crear `server/src/middleware/rateLimiter.js`**

```js
// server/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

module.exports = { globalLimiter, authLimiter };
```

- [ ] **Step 2: Actualizar `server/src/app.js` con limiters y headers completos**

```js
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

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

app.use('/api/auth',    authLimiter, authRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/servers/:id/channels', channelServersRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/channels/:id/messages', messagesChannelsRouter);
app.use('/api/messages', messagesRouter);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 3: Ejecutar todos los tests para verificar que nada se rompe**

```bash
NODE_ENV=test npx jest --runInBand
```

Expected: PASS — todos los tests pasan.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: rate limiting, security headers, final app.js assembly"
```

---

## Task 14: server.js — entry point HTTP + Socket.IO

**Files:**
- Create: `server/src/server.js`

- [ ] **Step 1: Crear `server/src/server.js`**

```js
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

setupGateway(io);

httpServer.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
```

- [ ] **Step 2: Commit (parcial — gateway aún no existe, este commit es sólo el entry point)**

```bash
git add server/src/server.js
git commit -m "feat: HTTP server entry point with Socket.IO scaffold"
```

---

## Task 15: Socket.IO gateway

**Files:**
- Create: `server/src/socket/gateway.js`
- Create: `server/src/socket/handlers/channel.handler.js`
- Create: `server/src/socket/handlers/message.handler.js`

- [ ] **Step 1: Crear `server/src/socket/gateway.js`**

```js
// server/src/socket/gateway.js
const { verifyAccessToken } = require('../config/jwt');
const { registerChannelHandlers } = require('./handlers/channel.handler');
const { registerMessageHandlers } = require('./handlers/message.handler');

function setupGateway(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user.userId})`);

    registerChannelHandlers(io, socket);
    registerMessageHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupGateway };
```

- [ ] **Step 2: Crear `server/src/socket/handlers/channel.handler.js`**

```js
// server/src/socket/handlers/channel.handler.js
const serversRepo = require('../../modules/servers/servers.repository');
const channelsRepo = require('../../modules/channels/channels.repository');

function registerChannelHandlers(io, socket) {
  socket.on('channel:join', async ({ channelId }) => {
    try {
      const channel = await channelsRepo.findChannelById(channelId);
      if (!channel) return socket.emit('error', { code: 'NOT_FOUND', message: 'Channel not found' });

      const membership = await serversRepo.getMembership(socket.user.userId, channel.server_id);
      if (!membership) return socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this server' });

      socket.join(`channel:${channelId}`);
    } catch (err) {
      socket.emit('error', { code: 'INTERNAL', message: 'Server error' });
    }
  });

  socket.on('channel:leave', ({ channelId }) => {
    socket.leave(`channel:${channelId}`);
  });
}

module.exports = { registerChannelHandlers };
```

- [ ] **Step 3: Crear `server/src/socket/handlers/message.handler.js`**

```js
// server/src/socket/handlers/message.handler.js
const messagesService = require('../../modules/messages/messages.service');

function registerMessageHandlers(io, socket) {
  socket.on('message:send', async ({ channelId, content }) => {
    try {
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return socket.emit('error', { code: 'VALIDATION', message: 'Content is required' });
      }
      if (content.length > 2000) {
        return socket.emit('error', { code: 'VALIDATION', message: 'Message too long' });
      }

      const message = await messagesService.createMessage({
        channelId,
        userId: socket.user.userId,
        content: content.trim(),
      });

      io.to(`channel:${channelId}`).emit('message:new', message);
    } catch (err) {
      const code = err.status === 403 ? 'FORBIDDEN' : 'INTERNAL';
      socket.emit('error', { code, message: err.message });
    }
  });

  socket.on('message:delete', async ({ messageId }) => {
    try {
      const { channelId } = await messagesService.deleteMessage(messageId, socket.user.userId);
      io.to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
    } catch (err) {
      const code = err.status === 403 ? 'FORBIDDEN' : err.status === 404 ? 'NOT_FOUND' : 'INTERNAL';
      socket.emit('error', { code, message: err.message });
    }
  });
}

module.exports = { registerMessageHandlers };
```

- [ ] **Step 4: Arrancar el servidor y verificar conexión manualmente**

```bash
cd server && npm run dev
```

Expected: `Server running on port 4000`. No errores en consola.

Verificar con curl que la API responde:
```bash
curl http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"password123"}'
```

Expected: `{"user":{...},"accessToken":"..."}`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: Socket.IO gateway + channel and message handlers"
```

---

## Task 16: Frontend — scaffold Vite + React + Tailwind + routing

**Files:**
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/index.css`

- [ ] **Step 1: Crear archivos de configuración**

```js
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
```

```js
// client/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

```js
// client/postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

```html
<!-- client/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect Chat</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

```css
/* client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-gray-800 text-gray-100 h-screen overflow-hidden; }
```

- [ ] **Step 2: Crear `client/src/main.jsx`**

```jsx
// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

- [ ] **Step 3: Crear `client/src/App.jsx` (routing skeleton)**

```jsx
// client/src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AppPage from './pages/AppPage';

function PrivateRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { token } = useAuth();
  return token ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/app"      element={
          <PrivateRoute>
            <SocketProvider>
              <AppPage />
            </SocketProvider>
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Verificar que Vite arranca**

```bash
cd client && npm run dev
```

Expected: `http://localhost:5173` accesible. Pantalla en blanco (los contextos aún no existen) — el error en consola es esperado.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: frontend scaffold (Vite + React + Tailwind + routing)"
```

---

## Task 17: AuthContext + páginas Login y Register

**Files:**
- Create: `client/src/context/AuthContext.jsx`
- Create: `client/src/socket.js`
- Create: `client/src/pages/Login.jsx`
- Create: `client/src/pages/Register.jsx`

- [ ] **Step 1: Crear `client/src/context/AuthContext.jsx`**

```jsx
// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const login = useCallback((accessToken, userData) => {
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setToken(null);
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) { setToken(null); setUser(null); return null; }
    const { accessToken } = await res.json();
    setToken(accessToken);
    return accessToken;
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 2: Crear `client/src/socket.js`**

```js
// client/src/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function getSocket(token) {
  if (!socket) {
    socket = io({ auth: { token }, autoConnect: false });
  } else {
    socket.auth.token = token;
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
```

- [ ] **Step 3: Crear `client/src/context/SocketContext.jsx`**

```jsx
// client/src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    s.connect();
    socketRef.current = s;
    return () => { disconnectSocket(); socketRef.current = null; };
  }, [token]);

  return (
    <SocketContext.Provider value={socketRef}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
```

- [ ] **Step 4: Crear `client/src/pages/Login.jsx`**

```jsx
// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      login(data.accessToken, data.user);
      navigate('/app');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="bg-gray-700 p-8 rounded-lg w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Connect Chat</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          className="w-full p-2 rounded bg-gray-600 text-white"
          type="email" placeholder="Email"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          className="w-full p-2 rounded bg-gray-600 text-white"
          type="password" placeholder="Password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          required
        />
        <button
          type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 p-2 rounded font-semibold"
        >
          {loading ? 'Loading...' : 'Log In'}
        </button>
        <p className="text-sm text-center text-gray-400">
          No account? <Link to="/register" className="text-indigo-400 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Crear `client/src/pages/Register.jsx`**

```jsx
// client/src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      login(data.accessToken, data.user);
      navigate('/app');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="bg-gray-700 p-8 rounded-lg w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Create Account</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          className="w-full p-2 rounded bg-gray-600 text-white"
          type="text" placeholder="Username"
          value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          required
        />
        <input
          className="w-full p-2 rounded bg-gray-600 text-white"
          type="email" placeholder="Email"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          className="w-full p-2 rounded bg-gray-600 text-white"
          type="password" placeholder="Password (min 8 chars)"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          required
        />
        <button
          type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 p-2 rounded font-semibold"
        >
          {loading ? 'Loading...' : 'Register'}
        </button>
        <p className="text-sm text-center text-gray-400">
          Have an account? <Link to="/login" className="text-indigo-400 hover:underline">Log In</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verificar login/register en el navegador**

Con el servidor corriendo (`cd server && npm run dev`) y el cliente corriendo (`cd client && npm run dev`):
1. Abrir `http://localhost:5173/register`
2. Registrar un usuario — debe redirigir a `/app` (página vacía por ahora)
3. Cerrar y abrir `http://localhost:5173/login`
4. Login con el mismo usuario — debe redirigir a `/app`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: AuthContext, SocketContext, Login and Register pages"
```

---

## Task 18: App page — ServerList, ChannelList, ChatArea, MessageInput

**Files:**
- Create: `client/src/pages/AppPage.jsx`
- Create: `client/src/components/ServerList.jsx`
- Create: `client/src/components/ChannelList.jsx`
- Create: `client/src/components/ChatArea.jsx`
- Create: `client/src/components/MessageInput.jsx`

- [ ] **Step 1: Crear `client/src/pages/AppPage.jsx`**

```jsx
// client/src/pages/AppPage.jsx
import React, { useState } from 'react';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';

export default function AppPage() {
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
  };

  return (
    <div className="flex h-screen">
      <ServerList onSelect={handleSelectServer} selectedId={selectedServer?.id} />
      <ChannelList server={selectedServer} onSelect={setSelectedChannel} selectedId={selectedChannel?.id} />
      <ChatArea channel={selectedChannel} />
    </div>
  );
}
```

- [ ] **Step 2: Crear `client/src/components/ServerList.jsx`**

```jsx
// client/src/components/ServerList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ServerList({ onSelect, selectedId }) {
  const { token, logout } = useAuth();
  const [servers, setServers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const fetchServers = async () => {
    const res = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setServers(await res.json());
  };

  useEffect(() => { fetchServers(); }, []);

  const createServer = async (e) => {
    e.preventDefault();
    await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName }),
    });
    setNewName(''); setShowCreate(false); fetchServers();
  };

  const joinServer = async (e) => {
    e.preventDefault();
    await fetch('/api/servers/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    setInviteCode(''); setShowJoin(false); fetchServers();
  };

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-2">
      {servers.map(s => (
        <button
          key={s.id}
          title={s.name}
          onClick={() => onSelect(s)}
          className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center
            ${selectedId === s.id ? 'bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {s.name[0].toUpperCase()}
        </button>
      ))}
      <button onClick={() => setShowCreate(true)} title="Create server"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-green-600 font-bold text-xl">+</button>
      <button onClick={() => setShowJoin(true)} title="Join server"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-blue-600 font-bold text-xs">↪</button>
      <div className="flex-1" />
      <button onClick={logout} title="Log out"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-red-600 text-xs">✕</button>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createServer} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Create Server</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="Server name"
              value={newName} onChange={e => setNewName(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={joinServer} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Join Server</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="Invite code (UUID)"
              value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Join</button>
              <button type="button" onClick={() => setShowJoin(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Crear `client/src/components/ChannelList.jsx`**

```jsx
// client/src/components/ChannelList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ChannelList({ server, onSelect, selectedId }) {
  const { token } = useAuth();
  const [channels, setChannels] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteVisible, setInviteVisible] = useState(false);

  useEffect(() => {
    if (!server) { setChannels([]); return; }
    fetch(`/api/servers/${server.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setChannels(data.channels || []));
  }, [server]);

  const createChannel = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.toLowerCase().replace(/\s+/g, '-') }),
    });
    setNewName(''); setShowCreate(false);
    fetch(`/api/servers/${server.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setChannels(data.channels || []));
  };

  if (!server) return <div className="w-48 bg-gray-800 flex items-center justify-center text-gray-500 text-sm">Select a server</div>;

  return (
    <div className="w-48 bg-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h2 className="font-bold truncate">{server.name}</h2>
        <button onClick={() => setInviteVisible(v => !v)}
          className="text-xs text-gray-400 hover:text-white mt-1">
          {inviteVisible ? 'Hide invite' : 'Show invite'}
        </button>
        {inviteVisible && (
          <p className="text-xs text-gray-300 break-all mt-1">{server.invite_code}</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center justify-between px-1 text-xs text-gray-400 uppercase mb-1">
          <span>Channels</span>
          <button onClick={() => setShowCreate(true)} className="hover:text-white">+</button>
        </div>
        {channels.map(c => (
          <button key={c.id} onClick={() => onSelect(c)}
            className={`w-full text-left px-2 py-1 rounded text-sm
              ${selectedId === c.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            # {c.name}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createChannel} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Create Channel</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="channel-name"
              value={newName} onChange={e => setNewName(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Crear `client/src/components/MessageInput.jsx`**

```jsx
// client/src/components/MessageInput.jsx
import React, { useState } from 'react';

export default function MessageInput({ onSend, channelName }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex gap-2">
      <input
        className="flex-1 bg-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder={`Message #${channelName}`}
        value={content}
        onChange={e => setContent(e.target.value)}
        maxLength={2000}
      />
      <button type="submit"
        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded font-semibold">
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Crear `client/src/components/ChatArea.jsx`**

```jsx
// client/src/components/ChatArea.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';

export default function ChatArea({ channel }) {
  const { token, user } = useAuth();
  const socketRef = useSocket();
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!channel) { setMessages([]); return; }

    fetch(`/api/channels/${channel.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setMessages);

    const socket = socketRef?.current;
    if (!socket) return;

    socket.emit('channel:join', { channelId: channel.id });

    const onMessage = (msg) => setMessages(prev => [...prev, msg]);
    const onDeleted = ({ messageId }) =>
      setMessages(prev => prev.filter(m => m.id !== messageId));

    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);

    return () => {
      socket.emit('channel:leave', { channelId: channel.id });
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
    };
  }, [channel?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (content) => {
    socketRef?.current?.emit('message:send', { channelId: channel.id, content });
  };

  const deleteMessage = async (messageId) => {
    socketRef?.current?.emit('message:delete', { messageId });
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-700">
      <div className="p-3 border-b border-gray-600 font-semibold"># {channel.name}</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-2 group">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
              {(msg.user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm">{msg.user?.username}</span>
                <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-gray-200">{msg.content}</p>
            </div>
            {msg.user?.id === user?.id && (
              <button onClick={() => deleteMessage(msg.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-1">
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={sendMessage} channelName={channel.name} />
    </div>
  );
}
```

- [ ] **Step 6: Probar el flujo completo en el navegador**

Con servidor y cliente corriendo:
1. Registrar usuario A en `http://localhost:5173/register`
2. Crear un servidor con el botón `+` en la barra izquierda
3. Crear un canal `#general`
4. Abrir una segunda ventana (modo incógnito), registrar usuario B
5. Pegar el invite code del servidor y unirse
6. Seleccionar `#general` en ambas ventanas y enviar mensajes
7. Verificar que los mensajes aparecen en tiempo real en ambas ventanas
8. Verificar que borrar un mensaje lo elimina en tiempo real

- [ ] **Step 7: Ejecutar todos los tests finales**

```bash
cd server && NODE_ENV=test npx jest --runInBand
```

Expected: PASS — todos los tests pasan.

- [ ] **Step 8: Commit final**

```bash
cd ..
git add .
git commit -m "feat: complete Phase 1 — AppPage, ServerList, ChannelList, ChatArea, MessageInput"
```

---

## Resumen de tasks

| # | Task | Tests |
|---|---|---|
| 1 | Scaffold del proyecto | — |
| 2 | Database migrations + pool | manual |
| 3 | Config JWT helpers | manual |
| 4 | validate + errorHandler middleware | — |
| 5 | Auth schema, repository, service | unit (Jest + mocks) |
| 6 | Auth controller + routes | integration (supertest) |
| 7 | authenticate middleware | unit |
| 8 | Users module | integration |
| 9 | Servers module | integration |
| 10 | isMember + isOwner middleware | — |
| 11 | Channels module | integration |
| 12 | Messages module | integration |
| 13 | Rate limiting + security headers | regression (todos los tests) |
| 14 | server.js entry point | — |
| 15 | Socket.IO gateway + handlers | manual |
| 16 | Frontend scaffold | manual |
| 17 | AuthContext + Login/Register | manual |
| 18 | App page + components | manual (flujo completo) |
