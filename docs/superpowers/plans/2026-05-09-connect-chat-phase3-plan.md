# Connect Chat — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir roles de moderador con permisos granulares, rediseñar la UI a un estilo moderno tipo Discord, y reemplazar el invite_code permanente por enlaces de invitación temporales compartibles.

**Architecture:** Tres subsistemas que se construyen sobre el stack modular existente. Los roles extienden el CHECK constraint de `server_members.role`. Los invites son un módulo nuevo (`invites/`) con su propio repo/service/controller/routes. La UI se rediseña componente a componente usando Tailwind y custom CSS properties, sin añadir nuevas dependencias de UI.

**Tech Stack adicional:** `nanoid@3` (códigos cortos de invitación — CommonJS compatible, añadir a `server/package.json`)

---

## Mapa de archivos

**Nuevos — backend:**
- `server/src/db/migrations/003_roles_invites.sql`
- `server/src/modules/invites/invites.repository.js`
- `server/src/modules/invites/invites.service.js`
- `server/src/modules/invites/invites.controller.js`
- `server/src/modules/invites/invites.routes.js`
- `server/src/modules/invites/invites.schema.js`
- `server/src/middleware/hasRole.js`
- `server/src/__tests__/invites/invites.integration.test.js`
- `server/src/__tests__/servers/member-management.integration.test.js`

**Nuevos — frontend:**
- `client/src/components/MemberList.jsx`
- `client/src/components/InviteModal.jsx`
- `client/src/pages/InvitePage.jsx`

**Modificados — backend:**
- `server/src/modules/servers/servers.repository.js` — `getMembersByServer`, `updateMemberRole`
- `server/src/modules/servers/servers.service.js` — `promoteToModerator`, `demoteToMember`, `kickMember`, `getMembers`
- `server/src/modules/servers/servers.controller.js` — handlers de gestión de miembros
- `server/src/modules/servers/servers.routes.js` — rutas de miembros
- `server/src/modules/channels/channels.service.js` — permitir moderador
- `server/src/modules/messages/messages.service.js` — permitir moderador/owner borrar cualquier mensaje
- `server/src/socket/handlers/message.handler.js` — sin cambios (delega a service)
- `server/src/app.js` — montar rutas de invites

**Modificados — frontend:**
- `client/src/App.jsx` — añadir ruta `/invite/:code`
- `client/src/pages/AppPage.jsx` — layout con MemberList
- `client/src/components/ServerList.jsx` — rediseño completo
- `client/src/components/ChannelList.jsx` — rediseño + botón de invite
- `client/src/components/ChatArea.jsx` — mensajes agrupados + rediseño
- `client/src/components/MessageInput.jsx` — rediseño
- `client/src/index.css` — design system con CSS custom properties

---

## Task 1: DB Migration — moderator role + tabla invites

**Files:**
- Create: `server/src/db/migrations/003_roles_invites.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- server/src/db/migrations/003_roles_invites.sql

-- 1. Ampliar el CHECK constraint de server_members para incluir 'moderator'
ALTER TABLE server_members DROP CONSTRAINT role_check;
ALTER TABLE server_members ADD CONSTRAINT role_check
  CHECK (role IN ('owner', 'moderator', 'member'));

-- 2. Tabla de invitaciones temporales
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(12) UNIQUE NOT NULL,
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ,
  max_uses    INT,
  use_count   INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_server ON invites(server_id);
```

- [ ] **Step 2: Instalar nanoid (CommonJS v3)**

```bash
cd server && npm install nanoid@3
cd ..
```

- [ ] **Step 3: Ejecutar la migración en el entorno de desarrollo**

```bash
cd server && node -e "
const pool = require('./src/db');
const fs   = require('fs');
const sql  = fs.readFileSync('./src/db/migrations/003_roles_invites.sql', 'utf8');
pool.query(sql).then(() => { console.log('Migration OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

Salida esperada: `Migration OK`

- [ ] **Step 4: Ejecutar la migración en la base de datos de test**

```bash
cd server && DATABASE_URL=postgresql://connectchat:connectchat@localhost:5433/connectchat_test node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('./src/db/migrations/003_roles_invites.sql', 'utf8');
pool.query(sql).then(() => { console.log('Test DB Migration OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

- [ ] **Step 5: Commit**

```bash
cd server && git add package.json package-lock.json && cd ..
git add server/src/db/migrations/003_roles_invites.sql server/package.json server/package-lock.json
git commit -m "feat: add moderator role and invites table (migration 003)"
```

---

## Task 2: Member management API (listar, promover, degradar, expulsar)

**Files:**
- Modify: `server/src/modules/servers/servers.repository.js`
- Modify: `server/src/modules/servers/servers.service.js`
- Modify: `server/src/modules/servers/servers.controller.js`
- Modify: `server/src/modules/servers/servers.routes.js`
- Create: `server/src/middleware/hasRole.js`
- Create: `server/src/__tests__/servers/member-management.integration.test.js`

- [ ] **Step 1: Escribir los tests que fallarán**

```js
// server/src/__tests__/servers/member-management.integration.test.js
const request = require('supertest');
const app     = require('../../app');
const pool    = require('../../db');

let ownerToken, memberToken, owner, member, server;

beforeAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE \'%@mgmt-test.com\'');

  const r1 = await request(app).post('/api/auth/register').send({ username: 'mgmt_owner', email: 'owner@mgmt-test.com', password: 'Pass1234!' });
  ownerToken = r1.body.accessToken;
  owner = r1.body.user;

  const r2 = await request(app).post('/api/auth/register').send({ username: 'mgmt_member', email: 'member@mgmt-test.com', password: 'Pass1234!' });
  memberToken = r2.body.accessToken;
  member = r2.body.user;

  const rs = await request(app).post('/api/servers').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'MgmtServer' });
  server = rs.body;

  // invite_code still exists on server for legacy join
  await request(app).post('/api/servers/join').set('Authorization', `Bearer ${memberToken}`).send({ invite_code: server.invite_code });
});

afterAll(() => pool.query('DELETE FROM users WHERE email LIKE \'%@mgmt-test.com\''));

describe('GET /api/servers/:id/members', () => {
  it('returns members with roles', async () => {
    const res = await request(app).get(`/api/servers/${server.id}/members`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'owner', username: 'mgmt_owner' }),
      expect.objectContaining({ role: 'member', username: 'mgmt_member' }),
    ]));
  });

  it('rejects non-members', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: 'mgmt_out', email: 'out@mgmt-test.com', password: 'Pass1234!' });
    const res = await request(app).get(`/api/servers/${server.id}/members`).set('Authorization', `Bearer ${r.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/servers/:id/members/:userId/role', () => {
  it('owner can promote member to moderator', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'moderator' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('moderator');
  });

  it('owner can demote moderator to member', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('member');
  });

  it('non-owner cannot change roles', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'moderator' });
    expect(res.status).toBe(403);
  });

  it('cannot change owner role', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${owner.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/servers/:id/members/:userId (kick)', () => {
  it('owner can kick a member', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: 'mgmt_kick', email: 'kick@mgmt-test.com', password: 'Pass1234!' });
    const kickToken = r.body.accessToken; const kickUser = r.body.user;
    await request(app).post('/api/servers/join').set('Authorization', `Bearer ${kickToken}`).send({ invite_code: server.invite_code });
    const res = await request(app).delete(`/api/servers/${server.id}/members/${kickUser.id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(204);
  });

  it('cannot kick the owner', async () => {
    const res = await request(app).delete(`/api/servers/${server.id}/members/${owner.id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd server && npx jest member-management --no-coverage 2>&1 | tail -20
```

Esperado: tests fallan con 404 (rutas no existen)

- [ ] **Step 3: Crear middleware hasRole**

```js
// server/src/middleware/hasRole.js
const serversRepo = require('../modules/servers/servers.repository');

function hasRole(...roles) {
  return async (req, res, next) => {
    try {
      const serverId = req.params.id;
      const membership = await serversRepo.getMembership(req.user.userId, serverId);
      if (!membership) return res.status(403).json({ error: 'Not a member of this server' });
      if (!roles.includes(membership.role)) return res.status(403).json({ error: 'Insufficient permissions' });
      req.membership = membership;
      next();
    } catch (err) { next(err); }
  };
}

module.exports = hasRole;
```

- [ ] **Step 4: Añadir funciones al repository**

Añadir al final de `server/src/modules/servers/servers.repository.js` (antes de `module.exports`):

```js
async function getMembersByServer(serverId) {
  const { rows } = await pool.query(
    `SELECT sm.user_id AS id, sm.role, sm.joined_at,
            u.username, u.avatar_url
     FROM server_members sm
     JOIN users u ON u.id = sm.user_id
     WHERE sm.server_id = $1
     ORDER BY
       CASE sm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
       u.username ASC`,
    [serverId]
  );
  return rows;
}

async function updateMemberRole(userId, serverId, role) {
  const { rows } = await pool.query(
    `UPDATE server_members SET role = $1
     WHERE user_id = $2 AND server_id = $3
     RETURNING user_id AS id, role, joined_at`,
    [role, userId, serverId]
  );
  return rows[0] || null;
}
```

Actualizar `module.exports` añadiendo `getMembersByServer` y `updateMemberRole`.

- [ ] **Step 5: Añadir funciones al service**

Añadir a `server/src/modules/servers/servers.service.js`:

```js
async function getMembers(serverId, userId) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  return serversRepo.getMembersByServer(serverId);
}

async function updateMemberRole(serverId, targetUserId, newRole, requesterId) {
  const target = await serversRepo.getMembership(targetUserId, serverId);
  if (!target) throw createError(404, 'Member not found');
  if (target.role === 'owner') throw createError(400, 'Cannot change the owner\'s role');
  if (!['moderator', 'member'].includes(newRole)) throw createError(400, 'Invalid role');
  return serversRepo.updateMemberRole(targetUserId, serverId, newRole);
}

async function kickMember(serverId, targetUserId, requesterId) {
  const target = await serversRepo.getMembership(targetUserId, serverId);
  if (!target) throw createError(404, 'Member not found');
  if (target.role === 'owner') throw createError(400, 'Cannot kick the server owner');
  const requester = await serversRepo.getMembership(requesterId, serverId);
  if (!requester) throw createError(403, 'Not a member');
  if (requester.role === 'member') throw createError(403, 'Insufficient permissions');
  // moderator cannot kick another moderator
  if (requester.role === 'moderator' && target.role === 'moderator') throw createError(403, 'Moderators cannot kick other moderators');
  await serversRepo.removeMember(targetUserId, serverId);
}
```

Actualizar `module.exports` añadiendo `getMembers`, `updateMemberRole`, `kickMember`.

- [ ] **Step 6: Añadir handlers al controller**

Añadir a `server/src/modules/servers/servers.controller.js`:

```js
async function getMembers(req, res, next) {
  try {
    const members = await serversService.getMembers(req.params.id, req.user.userId);
    res.json(members);
  } catch (err) { next(err); }
}

async function updateMemberRole(req, res, next) {
  try {
    const updated = await serversService.updateMemberRole(
      req.params.id, req.params.userId, req.body.role, req.user.userId
    );
    res.json(updated);
  } catch (err) { next(err); }
}

async function kickMember(req, res, next) {
  try {
    await serversService.kickMember(req.params.id, req.params.userId, req.user.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
```

Actualizar `module.exports`.

- [ ] **Step 7: Añadir rutas**

En `server/src/modules/servers/servers.routes.js`, añadir después de las rutas existentes (antes de `module.exports`):

```js
const hasRole = require('../../middleware/hasRole');
const { updateMemberRoleSchema } = require('./servers.schema');

router.get('/:id/members',                    ctrl.getMembers);
router.patch('/:id/members/:userId/role',     hasRole('owner'), validate(updateMemberRoleSchema), ctrl.updateMemberRole);
router.delete('/:id/members/:userId',         hasRole('owner', 'moderator'), ctrl.kickMember);
```

Añadir a `server/src/modules/servers/servers.schema.js`:

```js
const updateMemberRoleSchema = z.object({
  role: z.enum(['moderator', 'member']),
});
// añadir a module.exports
```

- [ ] **Step 8: Ejecutar los tests**

```bash
cd server && npx jest member-management --no-coverage 2>&1 | tail -30
```

Esperado: todos los tests pasan (✓)

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/servers/ server/src/middleware/hasRole.js server/src/__tests__/servers/member-management.integration.test.js
git commit -m "feat: add member management API (list, promote, demote, kick)"
```

---

## Task 3: Módulo de invitaciones (backend)

**Files:**
- Create: `server/src/modules/invites/invites.repository.js`
- Create: `server/src/modules/invites/invites.service.js`
- Create: `server/src/modules/invites/invites.controller.js`
- Create: `server/src/modules/invites/invites.routes.js`
- Create: `server/src/modules/invites/invites.schema.js`
- Modify: `server/src/app.js`
- Create: `server/src/__tests__/invites/invites.integration.test.js`

- [ ] **Step 1: Escribir los tests que fallarán**

```js
// server/src/__tests__/invites/invites.integration.test.js
const request = require('supertest');
const app     = require('../../app');
const pool    = require('../../db');

let ownerToken, memberToken, outsiderToken, server, member;

beforeAll(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE \'%@inv-test.com\'');

  const r1 = await request(app).post('/api/auth/register').send({ username: 'inv_owner', email: 'owner@inv-test.com', password: 'Pass1234!' });
  ownerToken = r1.body.accessToken;

  const r2 = await request(app).post('/api/auth/register').send({ username: 'inv_member', email: 'member@inv-test.com', password: 'Pass1234!' });
  memberToken = r2.body.accessToken; member = r2.body.user;

  const r3 = await request(app).post('/api/auth/register').send({ username: 'inv_outside', email: 'outside@inv-test.com', password: 'Pass1234!' });
  outsiderToken = r3.body.accessToken;

  const rs = await request(app).post('/api/servers').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'InvServer' });
  server = rs.body;
  await request(app).post('/api/servers/join').set('Authorization', `Bearer ${memberToken}`).send({ invite_code: server.invite_code });
});

afterAll(() => pool.query('DELETE FROM users WHERE email LIKE \'%@inv-test.com\''));

describe('POST /api/servers/:id/invites', () => {
  it('owner can create invite with expiry and maxUses', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresIn: 24, maxUses: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: expect.any(String), url: expect.stringContaining('/invite/') });
    expect(res.body.maxUses).toBe(10);
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('owner can create invite with no expiry', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeNull();
    expect(res.body.maxUses).toBeNull();
  });

  it('non-member cannot create invite', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/invites/:code (public preview)', () => {
  let inviteCode;
  beforeAll(async () => {
    const res = await request(app).post(`/api/servers/${server.id}/invites`).set('Authorization', `Bearer ${ownerToken}`).send({});
    inviteCode = res.body.code;
  });

  it('returns server preview without auth', async () => {
    const res = await request(app).get(`/api/invites/${inviteCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serverName: 'InvServer', memberCount: expect.any(Number) });
  });

  it('returns 404 for unknown code', async () => {
    const res = await request(app).get('/api/invites/nonexistent99');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/invites/:code/join', () => {
  let inviteCode;
  beforeAll(async () => {
    const res = await request(app).post(`/api/servers/${server.id}/invites`).set('Authorization', `Bearer ${ownerToken}`).send({ maxUses: 1 });
    inviteCode = res.body.code;
  });

  it('outsider can join via invite', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serverId: server.id });
  });

  it('returns 409 if already a member', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 410 when maxUses exhausted', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(410);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd server && npx jest invites.integration --no-coverage 2>&1 | tail -15
```

Esperado: tests fallan con 404

- [ ] **Step 3: Crear invites.schema.js**

```js
// server/src/modules/invites/invites.schema.js
const { z } = require('zod');

const createInviteSchema = z.object({
  expiresIn: z.number().int().positive().optional(),  // hours
  maxUses:   z.number().int().positive().optional(),
});

module.exports = { createInviteSchema };
```

- [ ] **Step 4: Crear invites.repository.js**

```js
// server/src/modules/invites/invites.repository.js
const pool = require('../../db');

async function createInvite({ code, serverId, creatorId, expiresAt, maxUses }) {
  const { rows } = await pool.query(
    `INSERT INTO invites (code, server_id, creator_id, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [code, serverId, creatorId, expiresAt || null, maxUses || null]
  );
  return rows[0];
}

async function findInviteByCode(code) {
  const { rows } = await pool.query(
    `SELECT i.*, s.name AS server_name,
            (SELECT COUNT(*) FROM server_members WHERE server_id = i.server_id)::int AS member_count,
            u.username AS creator_username
     FROM invites i
     JOIN servers s ON s.id = i.server_id
     JOIN users   u ON u.id = i.creator_id
     WHERE i.code = $1`,
    [code]
  );
  return rows[0] || null;
}

async function incrementUseCount(code) {
  await pool.query('UPDATE invites SET use_count = use_count + 1 WHERE code = $1', [code]);
}

module.exports = { createInvite, findInviteByCode, incrementUseCount };
```

- [ ] **Step 5: Crear invites.service.js**

```js
// server/src/modules/invites/invites.service.js
const { nanoid }   = require('nanoid');
const invitesRepo  = require('./invites.repository');
const serversRepo  = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createInvite(serverId, userId, { expiresIn, maxUses }) {
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (membership.role === 'member') throw createError(403, 'Only owner or moderator can create invites');

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;
  const code = nanoid(10);

  const invite = await invitesRepo.createInvite({ code, serverId, creatorId: userId, expiresAt, maxUses });
  const baseUrl = process.env.ALLOWED_ORIGIN || 'http://localhost:4000';
  return {
    code:      invite.code,
    url:       `${baseUrl}/invite/${invite.code}`,
    expiresAt: invite.expires_at,
    maxUses:   invite.max_uses,
    useCount:  invite.use_count,
  };
}

async function previewInvite(code) {
  const invite = await invitesRepo.findInviteByCode(code);
  if (!invite) throw createError(404, 'Invite not found');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw createError(410, 'Invite expired');
  if (invite.max_uses && invite.use_count >= invite.max_uses) throw createError(410, 'Invite has reached its maximum uses');
  return {
    serverName:       invite.server_name,
    serverIdHint:     invite.server_id,
    memberCount:      invite.member_count,
    inviterUsername:  invite.creator_username,
    expiresAt:        invite.expires_at,
    maxUses:          invite.max_uses,
    useCount:         invite.use_count,
  };
}

async function joinViaInvite(code, userId) {
  const invite = await invitesRepo.findInviteByCode(code);
  if (!invite) throw createError(404, 'Invite not found');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw createError(410, 'Invite expired');
  if (invite.max_uses && invite.use_count >= invite.max_uses) throw createError(410, 'Invite has reached its maximum uses');

  const existing = await serversRepo.getMembership(userId, invite.server_id);
  if (existing) throw createError(409, 'Already a member');

  await serversRepo.addMember(userId, invite.server_id);
  await invitesRepo.incrementUseCount(code);
  return { serverId: invite.server_id, serverName: invite.server_name };
}

module.exports = { createInvite, previewInvite, joinViaInvite };
```

- [ ] **Step 6: Crear invites.controller.js**

```js
// server/src/modules/invites/invites.controller.js
const invitesService = require('./invites.service');

async function createInvite(req, res, next) {
  try {
    const invite = await invitesService.createInvite(req.params.id, req.user.userId, req.body);
    res.status(201).json(invite);
  } catch (err) { next(err); }
}

async function previewInvite(req, res, next) {
  try {
    const preview = await invitesService.previewInvite(req.params.code);
    res.json(preview);
  } catch (err) { next(err); }
}

async function joinViaInvite(req, res, next) {
  try {
    const result = await invitesService.joinViaInvite(req.params.code, req.user.userId);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { createInvite, previewInvite, joinViaInvite };
```

- [ ] **Step 7: Crear invites.routes.js**

```js
// server/src/modules/invites/invites.routes.js
const { Router }   = require('express');
const authenticate = require('../../middleware/authenticate');
const validate     = require('../../middleware/validate');
const { createInviteSchema } = require('./invites.schema');
const ctrl = require('./invites.controller');

// Rutas bajo /api/servers/:id/invites
const serversInvitesRouter = Router({ mergeParams: true });
serversInvitesRouter.use(authenticate);
serversInvitesRouter.post('/', validate(createInviteSchema), ctrl.createInvite);

// Rutas públicas/autenticadas bajo /api/invites
const invitesRouter = Router();
invitesRouter.get('/:code',        ctrl.previewInvite);           // público
invitesRouter.post('/:code/join',  authenticate, ctrl.joinViaInvite);  // requiere auth

module.exports = { serversInvitesRouter, invitesRouter };
```

- [ ] **Step 8: Montar rutas en app.js**

En `server/src/app.js`, añadir después de los imports existentes:

```js
const { serversInvitesRouter, invitesRouter } = require('./modules/invites/invites.routes');
```

Y después de las rutas existentes:

```js
app.use('/api/servers/:id/invites', serversInvitesRouter);
app.use('/api/invites',             invitesRouter);
```

- [ ] **Step 9: Ejecutar los tests**

```bash
cd server && npx jest invites.integration --no-coverage 2>&1 | tail -30
```

Esperado: todos los tests pasan (✓)

- [ ] **Step 10: Commit**

```bash
git add server/src/modules/invites/ server/src/app.js server/src/__tests__/invites/
git commit -m "feat: add invites module with temporary shareable invite links"
```

---

## Task 4: Permisos basados en rol (canales y mensajes)

**Files:**
- Modify: `server/src/modules/channels/channels.service.js`
- Modify: `server/src/modules/messages/messages.service.js`

- [ ] **Step 1: Escribir tests para permisos de moderador en canales**

Añadir al final de `server/src/__tests__/channels/channels.integration.test.js`:

```js
describe('Moderator channel permissions', () => {
  let ownerTok, modTok, server;

  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE \'%@modchan-test.com\'');
    const r1 = await request(app).post('/api/auth/register').send({ username: 'modchan_owner', email: 'owner@modchan-test.com', password: 'Pass1234!' });
    ownerTok = r1.body.accessToken;
    const r2 = await request(app).post('/api/auth/register').send({ username: 'modchan_mod', email: 'mod@modchan-test.com', password: 'Pass1234!' });
    modTok = r2.body.accessToken; const mod = r2.body.user;
    const rs = await request(app).post('/api/servers').set('Authorization', `Bearer ${ownerTok}`).send({ name: 'ModChanServer' });
    server = rs.body;
    await request(app).post('/api/servers/join').set('Authorization', `Bearer ${modTok}`).send({ invite_code: server.invite_code });
    // promote to moderator
    await request(app).patch(`/api/servers/${server.id}/members/${mod.id}/role`).set('Authorization', `Bearer ${ownerTok}`).send({ role: 'moderator' });
  });

  it('moderator can create a channel', async () => {
    const res = await request(app).post(`/api/servers/${server.id}/channels`)
      .set('Authorization', `Bearer ${modTok}`).send({ name: 'mod-channel', type: 'text' });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

```bash
cd server && npx jest channels.integration --no-coverage 2>&1 | grep -A 5 "moderator can create"
```

Esperado: FAIL — 403

- [ ] **Step 3: Actualizar channels.service.js**

Reemplazar el contenido de `server/src/modules/channels/channels.service.js`:

```js
// server/src/modules/channels/channels.service.js
const channelsRepo = require('./channels.repository');
const serversRepo  = require('../servers/servers.repository');
const { createError } = require('../../middleware/errorHandler');

async function createChannel(serverId, name, userId, type = 'text') {
  const server = await serversRepo.findServerById(serverId);
  if (!server) throw createError(404, 'Server not found');
  const membership = await serversRepo.getMembership(userId, serverId);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (!['owner', 'moderator'].includes(membership.role)) throw createError(403, 'Only owner or moderator can create channels');
  return channelsRepo.createChannel(serverId, name, type);
}

async function deleteChannel(channelId, userId) {
  const channel = await channelsRepo.findChannelById(channelId);
  if (!channel) throw createError(404, 'Channel not found');
  const membership = await serversRepo.getMembership(userId, channel.server_id);
  if (!membership) throw createError(403, 'Not a member of this server');
  if (!['owner', 'moderator'].includes(membership.role)) throw createError(403, 'Only owner or moderator can delete channels');
  await channelsRepo.deleteChannel(channelId);
}

module.exports = { createChannel, deleteChannel };
```

- [ ] **Step 4: Actualizar messages.service.js para permitir moderadores borrar cualquier mensaje**

Reemplazar `deleteMessage` en `server/src/modules/messages/messages.service.js`:

```js
async function deleteMessage(messageId, userId) {
  const message = await messagesRepo.findMessageById(messageId);
  if (!message) throw createError(404, 'Message not found');

  if (message.user_id !== userId) {
    // check if requester is owner/moderator in this server
    const serverId = await messagesRepo.getChannelServerId(message.channel_id);
    const membership = await serversRepo.getMembership(userId, serverId);
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      throw createError(403, "Cannot delete another user's message");
    }
  }

  await messagesRepo.deleteMessage(messageId);
  return { messageId, channelId: message.channel_id };
}
```

- [ ] **Step 5: Ejecutar todos los tests existentes**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -20
```

Esperado: todos los tests pasan

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/channels/channels.service.js server/src/modules/messages/messages.service.js server/src/__tests__/channels/channels.integration.test.js
git commit -m "feat: allow moderators to create/delete channels and delete any message"
```

---

## Task 5: UI — Design system, layout y ServerList

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/pages/AppPage.jsx`
- Modify: `client/src/components/ServerList.jsx`

- [ ] **Step 1: Reemplazar index.css con el design system**

```css
/* client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-900: #1e1f22;
  --bg-800: #2b2d31;
  --bg-700: #313338;
  --bg-600: #383a40;
  --bg-500: #404249;
  --text-primary: #dbdee1;
  --text-muted:   #949ba4;
  --accent:       #5865f2;
  --accent-hover: #4752c4;
  --danger:       #f23f42;
  --success:      #23a559;
  --online:       #23a559;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg-700);
  color: var(--text-primary);
  font-family: 'gg sans', 'Noto Sans', Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.375;
}

::-webkit-scrollbar       { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg-900); border-radius: 4px; }

/* LiveKit voice styles */
.lk-room-container { width: 100%; height: 100%; background: var(--bg-700); }
.lk-grid-layout    { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 4px; padding: 4px; height: 100%; }
.lk-participant-tile { position: relative; background: var(--bg-800); border-radius: 8px; overflow: hidden; }
.voice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; padding: 16px; height: 100%; overflow-y: auto; }
.voice-controls-bar { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 16px; background: var(--bg-900); border-top: 1px solid rgba(255,255,255,0.06); }

/* Modal overlay */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  animation: fadeIn 0.15s ease;
}
.modal-box {
  background: var(--bg-800);
  border-radius: 8px;
  width: 440px;
  max-width: 90vw;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.modal-header {
  padding: 16px 16px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 16px;
}
.modal-body   { padding: 16px; }
.modal-footer { padding: 16px; background: var(--bg-900); display: flex; justify-content: flex-end; gap: 8px; }

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

/* Form inputs */
.field-label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-muted); margin-bottom: 8px; }
.field-input {
  width: 100%; padding: 10px 12px;
  background: var(--bg-900); border: 1px solid transparent;
  border-radius: 4px; color: var(--text-primary);
  font-size: 16px; outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: var(--accent); }
.field-input::placeholder { color: var(--text-muted); }

/* Buttons */
.btn         { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-ghost   { background: transparent; color: var(--text-primary); }
.btn-ghost:hover { background: var(--bg-500); }
.btn-danger  { background: var(--danger); color: #fff; }
.btn-danger:hover { background: #da373c; }

/* Role badges */
.badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; }
.badge-owner { background: #faa61a22; color: #faa61a; }
.badge-moderator { background: #3ba55d22; color: #3ba55d; }
```

- [ ] **Step 2: Reescribir AppPage.jsx con nuevo layout**

```jsx
// client/src/pages/AppPage.jsx
import React, { useState } from 'react';
import ServerList  from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea    from '../components/ChatArea';
import VoiceArea   from '../components/VoiceArea';
import MemberList  from '../components/MemberList';

export default function AppPage() {
  const [selectedServer,       setSelectedServer]       = useState(null);
  const [selectedChannel,      setSelectedChannel]      = useState(null);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState(null);
  const [showMembers,          setShowMembers]          = useState(false);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
    setSelectedVoiceChannel(null);
  };

  const activeSelectedId = selectedChannel?.id ?? selectedVoiceChannel?.id;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-700)' }}>
      <ServerList
        onSelect={handleSelectServer}
        selectedId={selectedServer?.id}
      />
      <ChannelList
        server={selectedServer}
        onSelect={(ch) => { setSelectedChannel(ch); setSelectedVoiceChannel(null); }}
        onSelectVoiceChannel={(ch) => { setSelectedVoiceChannel(ch); setSelectedChannel(null); }}
        selectedId={activeSelectedId}
        onToggleMembers={() => setShowMembers(v => !v)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {selectedVoiceChannel ? (
          <VoiceArea channel={selectedVoiceChannel} onLeave={() => setSelectedVoiceChannel(null)} />
        ) : selectedChannel ? (
          <ChatArea channel={selectedChannel} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecciona un canal para comenzar
          </div>
        )}
        {showMembers && selectedServer && (
          <MemberList server={selectedServer} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Reescribir ServerList.jsx**

```jsx
// client/src/components/ServerList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function ServerIcon({ server, active, onClick }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {active && (
        <div style={{
          position: 'absolute', left: 0, width: 4, height: 40,
          background: '#fff', borderRadius: '0 4px 4px 0',
        }} />
      )}
      <button
        title={server.name}
        onClick={onClick}
        style={{
          width: 48, height: 48, borderRadius: active ? 16 : '50%',
          background: active ? 'var(--accent)' : 'var(--bg-600)',
          border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
          fontWeight: 700, fontSize: 18, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'border-radius 0.15s, background 0.15s',
          marginLeft: 12,
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.borderRadius = '16px'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.borderRadius = '50%'; }}
      >
        {server.name[0].toUpperCase()}
      </button>
    </div>
  );
}

export default function ServerList({ onSelect, selectedId }) {
  const { token, user, logout } = useAuth();
  const [servers,     setServers]     = useState([]);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showJoin,    setShowJoin]    = useState(false);
  const [newName,     setNewName]     = useState('');
  const [inviteCode,  setInviteCode]  = useState('');
  const [error,       setError]       = useState('');

  const fetchServers = async () => {
    const res = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setServers(await res.json());
  };

  useEffect(() => { fetchServers(); }, []);

  const createServer = async (e) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) { setError('Failed to create server'); return; }
    setNewName(''); setShowCreate(false); fetchServers();
  };

  const joinServer = async (e) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/servers/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Invalid invite'); return; }
    setInviteCode(''); setShowJoin(false); fetchServers();
  };

  const sidebarStyle = {
    width: 72, minWidth: 72, background: 'var(--bg-900)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '12px 0', gap: 8, overflowY: 'auto',
  };

  const dividerStyle = {
    width: 32, height: 2, background: 'var(--bg-600)',
    borderRadius: 1, margin: '4px 0',
  };

  const addBtnStyle = (hoverColor) => ({
    width: 48, height: 48, borderRadius: '50%', border: 'none',
    cursor: 'pointer', background: 'var(--bg-700)',
    color: 'var(--success)', fontWeight: 700, fontSize: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-radius 0.15s, background 0.15s, color 0.15s',
  });

  return (
    <div style={sidebarStyle}>
      {servers.map(s => (
        <ServerIcon key={s.id} server={s} active={selectedId === s.id} onClick={() => onSelect(s)} />
      ))}

      <div style={dividerStyle} />

      <button
        title="Create server"
        onClick={() => { setError(''); setShowCreate(true); }}
        style={addBtnStyle()}
        onMouseEnter={e => { e.currentTarget.style.borderRadius = '16px'; e.currentTarget.style.background = 'var(--success)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.background = 'var(--bg-700)'; e.currentTarget.style.color = 'var(--success)'; }}
      >+</button>

      <button
        title="Join server via invite"
        onClick={() => { setError(''); setShowJoin(true); }}
        style={{ ...addBtnStyle(), color: 'var(--accent)' }}
        onMouseEnter={e => { e.currentTarget.style.borderRadius = '16px'; e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.background = 'var(--bg-700)'; e.currentTarget.style.color = 'var(--accent)'; }}
      >⤵</button>

      <div style={{ flex: 1 }} />

      <div style={dividerStyle} />

      <button
        title={`Logout (${user?.username || ''})`}
        onClick={logout}
        style={{ ...addBtnStyle(), color: 'var(--text-muted)', fontSize: 16 }}
        onMouseEnter={e => { e.currentTarget.style.borderRadius = '16px'; e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.background = 'var(--bg-700)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >⏻</button>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Create a Server</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Give your server a name.</p>
            </div>
            <form onSubmit={createServer}>
              <div className="modal-body">
                <label className="field-label">Server name</label>
                <input className="field-input" placeholder="My server" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Server</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Join a Server</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Enter an invite link or code below.</p>
            </div>
            <form onSubmit={joinServer}>
              <div className="modal-body">
                <label className="field-label">Invite link or code</label>
                <input className="field-input" placeholder="https://... or code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required autoFocus />
                {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Join Server</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Nota:** El `joinServer` del ServerList ahora también acepta la URL completa. Añadir lógica para extraer el código si el usuario pega una URL: en el handler `joinServer`, antes de hacer fetch, si `inviteCode` empieza por `http`, extraer el último segmento (`inviteCode.split('/').pop()`).

Actualizar el handler en ServerList:

```js
const joinServer = async (e) => {
  e.preventDefault(); setError('');
  let code = inviteCode.trim();
  if (code.startsWith('http')) code = code.split('/').pop();

  // Try new invite system first
  const inviteRes = await fetch(`/api/invites/${code}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (inviteRes.ok) {
    setInviteCode(''); setShowJoin(false); fetchServers(); return;
  }
  // Fallback: try legacy invite_code
  const legacyRes = await fetch('/api/servers/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ invite_code: code }),
  });
  if (!legacyRes.ok) { const d = await legacyRes.json(); setError(d.error || 'Invalid invite'); return; }
  setInviteCode(''); setShowJoin(false); fetchServers();
};
```

- [ ] **Step 4: Construir el frontend y verificar que arranca sin errores**

```bash
cd client && npm run build 2>&1 | tail -10
```

Esperado: `✓ built in ...`

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css client/src/pages/AppPage.jsx client/src/components/ServerList.jsx
git commit -m "feat: redesign UI — design system, layout and ServerList"
```

---

## Task 6: UI — ChannelList redesign + InviteModal

**Files:**
- Modify: `client/src/components/ChannelList.jsx`
- Create: `client/src/components/InviteModal.jsx`

- [ ] **Step 1: Crear InviteModal.jsx**

```jsx
// client/src/components/InviteModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function InviteModal({ server, onClose }) {
  const { token } = useAuth();
  const [expiresIn, setExpiresIn] = useState('24');
  const [maxUses,   setMaxUses]   = useState('');
  const [invite,    setInvite]    = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setCopied(false);
    const body = {};
    if (expiresIn !== 'never') body.expiresIn = Number(expiresIn);
    if (maxUses)               body.maxUses   = Number(maxUses);

    const res = await fetch(`/api/servers/${server.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) { setError('Failed to generate invite'); return; }
    setInvite(await res.json());
  };

  const copy = () => {
    navigator.clipboard.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 20 }}>Invite people to {server.name}</h2>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Expiry</label>
              <select
                value={expiresIn}
                onChange={e => setExpiresIn(e.target.value)}
                className="field-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="1">1 hour</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Max uses</label>
              <input
                className="field-input"
                type="number" min="1" placeholder="Unlimited"
                value={maxUses} onChange={e => setMaxUses(e.target.value)}
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Generating…' : 'Generate invite link'}
          </button>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}

          {invite && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="field-input"
                readOnly value={invite.url}
                style={{ flex: 1, fontSize: 13 }}
                onFocus={e => e.target.select()}
              />
              <button className="btn btn-primary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {invite?.expiresAt && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
              Expires {new Date(invite.expiresAt).toLocaleString()}
              {invite.maxUses ? ` · Max ${invite.maxUses} uses` : ' · Unlimited uses'}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reescribir ChannelList.jsx**

```jsx
// client/src/components/ChannelList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import InviteModal from './InviteModal';

function ChannelItem({ channel, active, onClick }) {
  const isVoice = channel.type === 'voice';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '6px 8px', border: 'none', cursor: 'pointer',
        borderRadius: 4, textAlign: 'left', fontSize: 15,
        background: active ? 'var(--bg-500)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-600)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
    >
      <span style={{ opacity: 0.6, fontSize: 18, width: 20, textAlign: 'center' }}>{isVoice ? '🔊' : '#'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</span>
    </button>
  );
}

function SectionHeader({ label, canAdd, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 8px 4px', marginTop: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
        {label}
      </span>
      {canAdd && (
        <button
          onClick={onAdd} title="Create channel"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >+</button>
      )}
    </div>
  );
}

export default function ChannelList({ server, onSelect, onSelectVoiceChannel, selectedId, onToggleMembers }) {
  const { token } = useAuth();
  const [channels,     setChannels]     = useState([]);
  const [membership,   setMembership]   = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showInvite,   setShowInvite]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newType,      setNewType]      = useState('text');
  const [headerMenu,   setHeaderMenu]   = useState(false);

  const fetchChannels = () => {
    if (!server) { setChannels([]); setMembership(null); return; }
    fetch(`/api/servers/${server.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setChannels(data.channels || []));
    fetch(`/api/servers/${server.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(members => {
        // find own membership from AuthContext would be ideal, but we get userId from token via members list
        // We identify ourselves by fetching /api/users/me or parsing from members
        // For simplicity, store all members and find own role in MemberList
        // Here we just need to know if current user is owner/moderator
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const me = members.find(m => m.id === tokenPayload.userId);
        setMembership(me || null);
      }).catch(() => {});
  };

  useEffect(() => { fetchChannels(); }, [server?.id]);

  const canManage = membership && ['owner', 'moderator'].includes(membership.role);

  const createChannel = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.toLowerCase().replace(/\s+/g, '-'), type: newType }),
    });
    setNewName(''); setNewType('text'); setShowCreate(false); fetchChannels();
  };

  const leaveServer = async () => {
    if (!confirm(`Leave "${server.name}"?`)) return;
    await fetch(`/api/servers/${server.id}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    window.location.reload();
  };

  const textChannels  = channels.filter(c => !c.type || c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  if (!server) return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      Select a server
    </div>
  );

  return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', flexDirection: 'column' }}>
      {/* Server header */}
      <button
        onClick={() => setHeaderMenu(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.2)',
          background: 'none', border: 'none', borderBottom: '1px solid rgba(0,0,0,0.2)',
          cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15,
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-600)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{headerMenu ? '▲' : '▼'}</span>
      </button>

      {headerMenu && (
        <div style={{ background: 'var(--bg-900)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {canManage && (
            <button style={menuItemStyle} onClick={() => { setShowInvite(true); setHeaderMenu(false); }}>
              Invite People
            </button>
          )}
          <button style={menuItemStyle} onClick={() => { onToggleMembers(); setHeaderMenu(false); }}>
            Show Members
          </button>
          {membership?.role !== 'owner' && (
            <button style={{ ...menuItemStyle, color: 'var(--danger)' }} onClick={leaveServer}>
              Leave Server
            </button>
          )}
        </div>
      )}

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        <SectionHeader label="Text Channels" canAdd={canManage} onAdd={() => { setNewType('text'); setShowCreate(true); }} />
        {textChannels.map(c => (
          <ChannelItem key={c.id} channel={c} active={selectedId === c.id} onClick={() => onSelect(c)} />
        ))}

        <SectionHeader label="Voice Channels" canAdd={canManage} onAdd={() => { setNewType('voice'); setShowCreate(true); }} />
        {voiceChannels.map(c => (
          <ChannelItem key={c.id} channel={c} active={selectedId === c.id} onClick={() => onSelectVoiceChannel(c)} />
        ))}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Create Channel</h2>
            </div>
            <form onSubmit={createChannel}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="field-label">Channel type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['text', 'voice'].map(t => (
                      <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: newType === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <input type="radio" name="chType" value={t} checked={newType === t} onChange={() => setNewType(t)} />
                        {t === 'text' ? '# Text' : '🔊 Voice'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Channel name</label>
                  <input className="field-input" placeholder={newType === 'text' ? 'general' : 'voice-chat'} value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Channel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvite && <InviteModal server={server} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

const menuItemStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-primary)', fontSize: 14, padding: '6px 8px',
  borderRadius: 4, textAlign: 'left', width: '100%',
  transition: 'background 0.1s',
};
```

- [ ] **Step 3: Construir y verificar**

```bash
cd client && npm run build 2>&1 | tail -10
```

Esperado: sin errores de compilación

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ChannelList.jsx client/src/components/InviteModal.jsx
git commit -m "feat: redesign ChannelList with role-aware sections and InviteModal"
```

---

## Task 7: UI — ChatArea con mensajes agrupados + MemberList + InvitePage

**Files:**
- Modify: `client/src/components/ChatArea.jsx`
- Modify: `client/src/components/MessageInput.jsx`
- Create: `client/src/components/MemberList.jsx`
- Create: `client/src/pages/InvitePage.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Reescribir ChatArea.jsx con mensajes agrupados**

```jsx
// client/src/components/ChatArea.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';

function groupMessages(messages) {
  const FIVE_MIN = 5 * 60 * 1000;
  const groups = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const sameAuthor = last && last.userId === msg.user?.id;
    const lastTs = last?.messages[last.messages.length - 1]?.created_at;
    const within5 = lastTs && (new Date(msg.created_at) - new Date(lastTs)) < FIVE_MIN;
    if (sameAuthor && within5) {
      last.messages.push(msg);
    } else {
      groups.push({ userId: msg.user?.id, author: msg.user, messages: [msg] });
    }
  }
  return groups;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

export default function ChatArea({ channel }) {
  const { token, user } = useAuth();
  const socketRef  = useSocket();
  const [messages, setMessages] = useState([]);
  const [hoverId,  setHoverId]  = useState(null);
  const bottomRef  = useRef(null);

  const tokenPayload = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const myUserId = tokenPayload?.userId;

  useEffect(() => {
    if (!channel) { setMessages([]); return; }
    fetch(`/api/channels/${channel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages);
    const socket = socketRef?.current;
    if (!socket) return;
    socket.emit('channel:join', { channelId: channel.id });
    const onMsg     = (msg)   => setMessages(prev => [...prev, msg]);
    const onDeleted = ({ messageId }) => setMessages(prev => prev.filter(m => m.id !== messageId));
    socket.on('message:new',     onMsg);
    socket.on('message:deleted', onDeleted);
    return () => {
      socket.emit('channel:leave', { channelId: channel.id });
      socket.off('message:new',     onMsg);
      socket.off('message:deleted', onDeleted);
    };
  }, [channel?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const deleteMessage = (id) => socketRef?.current?.emit('message:delete', { messageId: id });
  const sendMessage   = (content) => socketRef?.current?.emit('message:send', { channelId: channel.id, content });

  if (!channel) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Select a channel to start chatting
    </div>
  );

  const groups = groupMessages(messages);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-700)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.2)', background: 'var(--bg-700)', zIndex: 1, boxShadow: '0 1px 0 rgba(0,0,0,0.2)' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 20 }}>#</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{channel.name}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ padding: '2px 16px', marginBottom: 4 }}>
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 16, marginTop: 2,
              }}>
                {(group.author?.username || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{group.author?.username}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatTime(group.messages[0].created_at)}
                  </span>
                </div>
                {group.messages.map(msg => (
                  <div
                    key={msg.id}
                    onMouseEnter={() => setHoverId(msg.id)}
                    onMouseLeave={() => setHoverId(null)}
                    style={{ position: 'relative', padding: '1px 0', borderRadius: 4, transition: 'background 0.1s', background: hoverId === msg.id ? 'rgba(0,0,0,0.1)' : 'transparent' }}
                  >
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {msg.content}
                    </p>
                    {hoverId === msg.id && (
                      <div style={{ position: 'absolute', right: 8, top: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={formatDate(msg.created_at)}>
                          {formatDate(msg.created_at)}
                        </span>
                        {msg.user?.id === myUserId && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: '0 4px' }}
                            title="Delete message"
                          >✕</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} channelName={channel.name} />
    </div>
  );
}
```

- [ ] **Step 2: Reescribir MessageInput.jsx**

```jsx
// client/src/components/MessageInput.jsx
import React, { useState } from 'react';

export default function MessageInput({ onSend, channelName }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e);
  };

  return (
    <form onSubmit={submit} style={{ padding: '0 16px 16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-600)', borderRadius: 8, overflow: 'hidden',
      }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 15, padding: '12px 16px',
            resize: 'none', fontFamily: 'inherit', lineHeight: 1.375,
          }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          style={{
            background: 'none', border: 'none', cursor: value.trim() ? 'pointer' : 'default',
            color: value.trim() ? 'var(--accent)' : 'var(--text-muted)',
            padding: '0 16px', fontSize: 20, transition: 'color 0.15s',
          }}
          title="Send"
        >➤</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Crear MemberList.jsx**

```jsx
// client/src/components/MemberList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function MemberRow({ member, myRole, myUserId, serverId, token, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMe = member.id === myUserId;
  const canManage = (myRole === 'owner') && !isMe && member.role !== 'owner';

  const changeRole = async (role) => {
    setMenuOpen(false);
    await fetch(`/api/servers/${serverId}/members/${member.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    onRefresh();
  };

  const kick = async () => {
    setMenuOpen(false);
    if (!confirm(`Kick ${member.username}?`)) return;
    await fetch(`/api/servers/${serverId}/members/${member.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    onRefresh();
  };

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: canManage ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (canManage) e.currentTarget.style.background = 'var(--bg-600)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setMenuOpen(false); }}
      onClick={() => { if (canManage) setMenuOpen(v => !v); }}
    >
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {member.username[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.username}{isMe ? ' (you)' : ''}
        </div>
        {member.role !== 'member' && (
          <span className={`badge badge-${member.role}`}>{member.role}</span>
        )}
      </div>

      {menuOpen && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-900)', borderRadius: 6, padding: 4, zIndex: 10, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          {member.role === 'member' && (
            <button style={ctxItemStyle} onClick={() => changeRole('moderator')}>Promote to Moderator</button>
          )}
          {member.role === 'moderator' && (
            <button style={ctxItemStyle} onClick={() => changeRole('member')}>Demote to Member</button>
          )}
          <button style={{ ...ctxItemStyle, color: 'var(--danger)' }} onClick={kick}>Kick</button>
        </div>
      )}
    </div>
  );
}

const ctxItemStyle = {
  display: 'block', width: '100%', background: 'none', border: 'none',
  color: 'var(--text-primary)', fontSize: 14, padding: '6px 8px',
  textAlign: 'left', cursor: 'pointer', borderRadius: 4,
};

export default function MemberList({ server }) {
  const { token } = useAuth();
  const [members, setMembers] = useState([]);

  const tokenPayload = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const myUserId = tokenPayload?.userId;
  const me = members.find(m => m.id === myUserId);
  const myRole = me?.role || 'member';

  const fetchMembers = () => {
    fetch(`/api/servers/${server.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMembers).catch(() => {});
  };

  useEffect(() => { fetchMembers(); }, [server?.id]);

  const byRole = { owner: [], moderator: [], member: [] };
  members.forEach(m => byRole[m.role]?.push(m));

  const sections = [
    { key: 'owner',     label: 'Owner' },
    { key: 'moderator', label: `Moderators — ${byRole.moderator.length}` },
    { key: 'member',    label: `Members — ${byRole.member.length}` },
  ];

  return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '16px 12px 8px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
        Members — {members.length}
      </div>
      {sections.map(({ key, label }) => byRole[key].length > 0 && (
        <div key={key}>
          <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {label}
          </div>
          <div style={{ padding: '0 4px' }}>
            {byRole[key].map(m => (
              <MemberRow
                key={m.id}
                member={m}
                myRole={myRole}
                myUserId={myUserId}
                serverId={server.id}
                token={token}
                onRefresh={fetchMembers}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Crear InvitePage.jsx**

```jsx
// client/src/pages/InvitePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function InvitePage() {
  const { code }     = useParams();
  const { token }    = useAuth();
  const navigate     = useNavigate();
  const [preview,    setPreview]  = useState(null);
  const [error,      setError]    = useState('');
  const [joining,    setJoining]  = useState(false);
  const [joined,     setJoined]   = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${code}`)
      .then(r => { if (!r.ok) throw new Error('Invite not found or expired'); return r.json(); })
      .then(setPreview)
      .catch(e => setError(e.message));
  }, [code]);

  const join = async () => {
    if (!token) { navigate(`/login?redirect=/invite/${code}`); return; }
    setJoining(true);
    const res = await fetch(`/api/invites/${code}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setJoining(false);
    if (res.status === 409) { navigate('/app'); return; }
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to join'); return; }
    setJoined(true);
    setTimeout(() => navigate('/app'), 1500);
  };

  const containerStyle = {
    minHeight: '100vh', background: 'var(--bg-900)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const cardStyle = {
    background: 'var(--bg-800)', borderRadius: 8,
    padding: 40, maxWidth: 440, width: '90vw', textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  };

  if (error) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h2 style={{ margin: '0 0 8px' }}>Invalid Invite</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/app')}>Go to App</button>
      </div>
    </div>
  );

  if (!preview) return (
    <div style={containerStyle}>
      <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, margin: '0 auto 20px' }}>
          {preview.serverName[0].toUpperCase()}
        </div>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 4px', fontSize: 14 }}>
          {preview.inviterUsername} invited you to join
        </p>
        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{preview.serverName}</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 32px', fontSize: 14 }}>
          {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
        </p>

        {joined ? (
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>Joined! Redirecting…</p>
        ) : (
          <button className="btn btn-primary" style={{ fontSize: 16, padding: '12px 32px' }} onClick={join} disabled={joining}>
            {joining ? 'Joining…' : `Accept Invite`}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Actualizar App.jsx para añadir la ruta /invite/:code**

```jsx
// client/src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login      from './pages/Login';
import Register   from './pages/Register';
import AppPage    from './pages/AppPage';
import InvitePage from './pages/InvitePage';

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
        <Route path="/login"        element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"     element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/app"          element={
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

- [ ] **Step 6: Actualizar app.js para servir InvitePage (SPA fallback ya lo cubre)**

La ruta `/invite/:code` ya está cubierta por el fallback SPA que sirve `index.html`. No se necesitan cambios en el backend.

- [ ] **Step 7: Construir y verificar**

```bash
cd client && npm run build 2>&1 | tail -15
```

Esperado: sin errores. Bundle generado correctamente.

- [ ] **Step 8: Ejecutar todos los tests del backend para verificar no hay regresiones**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -20
```

Esperado: todos los tests pasan.

- [ ] **Step 9: Commit final**

```bash
git add client/src/components/ChatArea.jsx client/src/components/MessageInput.jsx \
        client/src/components/MemberList.jsx client/src/pages/InvitePage.jsx client/src/App.jsx
git commit -m "feat: redesign ChatArea/MessageInput, add MemberList panel and InvitePage"
```

---

## Verificación end-to-end en el LXC

Tras implementar todas las tareas, en el LXC:

```bash
cd /opt/Connect_chat && git pull
cd server && npm install    # nanoid@3
cd ../client && npm run build
cd .. && pm2 restart all
```

Flujo a probar:
1. Crear un servidor → el owner ve el botón "+" para canales
2. Generar un invite link desde "Invite People"
3. Abrir el link en una pestaña privada → ver la InvitePage con nombre del servidor → aceptar
4. El nuevo miembro se une y aparece en la MemberList
5. El owner promueve al miembro a moderador → aparece badge "moderator"
6. El moderador puede crear canales y borrar mensajes de otros
7. El moderador puede expulsar miembros (no otros moderadores ni el owner)
