# Connect Chat — Phase 2 Implementation Plan

## Canales de Voz y Video con WebRTC/LiveKit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar canales de voz/video en tiempo real usando LiveKit SFU. Los usuarios pueden unirse a canales de voz, ver grilla de participantes, controlar micrófono y cámara.

**Architecture:** LiveKit SFU en Docker, generación de tokens en backend (JWT LiveKit), grid de video en React usando `@livekit/components-react`. Base de datos extendida para diferenciar canales texto/voz.

**Tech Stack (Adicional a Phase 1):**

- Backend: `livekit-server-sdk`, zod schemas para token requests
- Frontend: `@livekit/components-react`, `livekit-client`
- Infraestructura: LiveKit Docker imagen oficial

---

## Mapa de archivos nuevos/modificados

```
connect-chat/
├── docker-compose.yml                      # ✏️ MODIFY: agregar LiveKit
├── .env.example                            # ✏️ MODIFY: LIVEKIT_* vars
├── server/
│   ├── package.json                        # ✏️ MODIFY: depender livekit-server-sdk
│   └── src/
│       ├── db/
│       │   └── migrations/
│       │       └── 002_add_channel_type.sql     # 🆕 CREATE
│       ├── modules/
│       │   ├── channels/
│       │   │   ├── channels.schema.js      # ✏️ MODIFY: agregar type
│       │   │   ├── channels.repository.js  # ✏️ MODIFY: type en INSERT/SELECT
│       │   │   ├── channels.controller.js  # ✏️ MODIFY: type en create
│       │   │   └── channels.routes.js      # (sin cambios)
│       │   └── voice/                           # 🆕 CREATE (nuevo módulo)
│       │       ├── voice.schema.js              # 🆕 CREATE
│       │       ├── voice.controller.js          # 🆕 CREATE
│       │       └── voice.routes.js              # 🆕 CREATE
│       ├── app.js                          # ✏️ MODIFY: montar /api/voice
│       └── config/
│           └── env.js                      # ✏️ MODIFY: LIVEKIT_* vars
├── __tests__/
│   ├── voice/                                   # 🆕 CREATE
│   │   └── voice.controller.test.js            # 🆕 CREATE
│   └── channels/
│       └── channels.integration.test.js    # ✏️ MODIFY: tests para type
├── client/
│   ├── package.json                        # ✏️ MODIFY: @livekit/components-react
│   └── src/
│       ├── index.css                       # ✏️ MODIFY: estilos grid video
│       ├── components/
│       │   ├── ChannelList.jsx             # ✏️ MODIFY: mostrar tipos (#/🔊)
│       │   ├── ChatArea.jsx                # (sin cambios)
│       │   ├── VoiceArea.jsx               # 🆕 CREATE
│       │   ├── ParticipantTile.jsx         # 🆕 CREATE
│       │   └── VoiceControls.jsx           # 🆕 CREATE
│       └── pages/
│           └── AppPage.jsx                 # ✏️ MODIFY: condicional render
```

---

## Task 1: Docker & Environment — Setup LiveKit

**Files:**

- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `server/package.json`
- Modify: `server/src/config/env.js`

- [ ] **Step 1: Modificar `docker-compose.yml` — agregar LiveKit**

Editar archivo existente y agregar servicio:

```yaml
# docker-compose.yml (agregado al final de services:)

livekit:
  image: livekit/livekit-server:latest
  container_name: connect-chat-livekit
  command: --dev
  ports:
    - "7880:7880" # HTTP/WebSocket (clients)
    - "7881:7881" # Admin/metrics
    - "7882:7882/udp" # Media (UDP)
  environment:
    - LIVEKIT_KEYS=devkey:secret
  depends_on:
    - postgres
```

Verificar que `docker-compose.yml` incluya a `postgres` ya configurado de Phase 1.

Expected: Archivo separado en servicios `postgres`, `postgres_test`, y `livekit`.

- [ ] **Step 2: Actualizar `.env.example`**

Agregar al final:

```bash
# LiveKit configuration
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

Copiar a `.env`:

```bash
cp .env.example .env  # (sobrescribir o verificar que tenga las nuevas vars)
```

- [ ] **Step 3: Instalar `livekit-server-sdk` en backend**

```bash
cd server
npm install livekit-server-sdk
```

Expected: `node_modules/livekit-server-sdk/` creado. Verificar con `npm list livekit-server-sdk`.

- [ ] **Step 4: Actualizar `server/src/config/env.js`**

Agregar variables LiveKit al módulo `env.js`:

```js
// server/src/config/env.js
// ... existing exports ...

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  DATABASE_URL: required("DATABASE_URL"),
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
  JWT_SECRET: required("JWT_SECRET"),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || "15m",
  JWT_REFRESH_TTL_DAYS: parseInt(process.env.JWT_REFRESH_TTL_DAYS || "7", 10),
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  // 🆕 Agregar:
  LIVEKIT_URL: process.env.LIVEKIT_URL || "ws://localhost:7880",
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || "devkey",
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || "secret",
};
```

- [ ] **Step 5: Levantar Docker con LiveKit**

```bash
cd .. && docker compose up -d
```

Expected: tres contenedores en estado `running`: `postgres`, `postgres_test`, `connect-chat-livekit`.

Verificar con:

```bash
docker compose ps
```

- [ ] **Step 6: Probar conexión a LiveKit (opcional)**

Hacer curl a health endpoint de LiveKit:

```bash
curl -I http://localhost:7881/status
```

Expected: HTTP 200 (o similar endpoint de status).

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example server/package.json server/src/config/env.js
git commit -m "feat: setup LiveKit infrastructure, docker compose, env vars"
```

---

## Task 2: Database — Migración para Channel Types

**Files:**

- Create: `server/src/db/migrations/002_add_channel_type.sql`
- Modify: `server/src/db/migrate.js` (si es necesario)

- [ ] **Step 1: Crear migración `002_add_channel_type.sql`**

Crear archivo nuevo:

```sql
-- server/src/db/migrations/002_add_channel_type.sql
-- Agregar soporte para canales de voz

ALTER TABLE channels
ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'text'
CHECK (type IN ('text', 'voice'));

-- Índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_channels_type_server
ON channels(server_id, type);
```

Expected: Archivo creado en `server/src/db/migrations/002_add_channel_type.sql`.

- [ ] **Step 2: Verificar `migrate.js` — lee archivos en orden**

Verificar que `server/src/db/migrate.js` lee migraciones en orden alfabético (lo hace automáticamente con `.sort()`). No hay cambios necesarios.

- [ ] **Step 3: Ejecutar migración en desarrollo**

```bash
cd server && node src/db/migrate.js
```

Expected output:

```
Running migration: 001_init.sql
Running migration: 002_add_channel_type.sql
Migrations complete.
```

- [ ] **Step 4: Ejecutar migración en test DB**

```bash
MIGRATE_TEST=1 node src/db/migrate.js
```

Expected: mismo output en puerto 5433.

- [ ] **Step 5: Verificar tabla en DB**

```bash
psql postgresql://connectchat:connectchat@localhost:5432/connectchat -c "\d channels"
```

Expected: columna `type` visible, tipo `character varying`, default 'text', CHECK constraint presente.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/migrations/002_add_channel_type.sql
git commit -m "feat: database migration for voice channel support"
```

---

## Task 3: Backend — Módulo Channels (Actualizar para Type)

**Files:**

- Modify: `server/src/modules/channels/channels.schema.js`
- Modify: `server/src/modules/channels/channels.repository.js`
- Modify: `server/src/modules/channels/channels.controller.js`

- [ ] **Step 1: Actualizar `channels.schema.js`**

Modificar schema de creación para incluir `type`:

```js
// server/src/modules/channels/channels.schema.js
const { z } = require("zod");

// Agregar/actualizar:
const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Channel name must be lowercase alphanumeric with hyphens",
    ),
  type: z.enum(["text", "voice"]).default("text"), // 🆕
});

module.exports = {
  createChannelSchema,
  // ... otros schemas ...
};
```

- [ ] **Step 2: Actualizar `channels.repository.js`**

Modificar `createChannel` para incluir `type`:

```js
// server/src/modules/channels/channels.repository.js
async function createChannel(serverId, { name, type = "text" }) {
  const query = `
    INSERT INTO channels (server_id, name, type)
    VALUES ($1, $2, $3)
    RETURNING id, server_id, name, type, created_at;
  `;
  const result = await pool.query(query, [serverId, name, type]);
  return result.rows[0];
}

// Actualizar getChannelsByServerId para incluir type:
async function getChannelsByServerId(serverId) {
  const query = `
    SELECT id, server_id, name, type, created_at
    FROM channels
    WHERE server_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [serverId]);
  return result.rows;
}

// Actualizar getChannelById para incluir type:
async function getChannelById(channelId) {
  const query = `
    SELECT id, server_id, name, type, created_at
    FROM channels
    WHERE id = $1;
  `;
  const result = await pool.query(query, [channelId]);
  return result.rows[0];
}

module.exports = {
  createChannel,
  getChannelsByServerId,
  getChannelById,
  // ... otros métodos ...
};
```

- [ ] **Step 3: Actualizar `channels.controller.js`**

Modificar `createChannel` controller para pasar `type`:

```js
// server/src/modules/channels/channels.controller.js
const { createChannelSchema } = require("./channels.schema");
const { createChannel } = require("./channels.service");

async function createChannelHandler(req, res) {
  const { name, type } = createChannelSchema.parse(req.body);
  const { serverId } = req.params;

  // Verificar membresía y permisos (asumiendo middleware existente)
  const channel = await createChannel(serverId, { name, type }); // 🆕 type incluido

  res.status(201).json(channel);
}

module.exports = {
  createChannelHandler,
  // ... otros handlers ...
};
```

- [ ] **Step 4: Commit**

```bash
git add server/src/modules/channels/
git commit -m "feat: add channel type support (text/voice) to channels module"
```

---

## Task 4: Backend — Nuevo módulo Voice

**Files:**

- Create: `server/src/modules/voice/voice.schema.js`
- Create: `server/src/modules/voice/voice.controller.js`
- Create: `server/src/modules/voice/voice.routes.js`

- [ ] **Step 1: Crear `server/src/modules/voice/voice.schema.js`**

```js
// server/src/modules/voice/voice.schema.js
const { z } = require("zod");

const generateTokenSchema = z.object({
  channelId: z.string().uuid("Invalid channel ID format"),
});

module.exports = {
  generateTokenSchema,
};
```

- [ ] **Step 2: Crear `server/src/modules/voice/voice.controller.js`**

```js
// server/src/modules/voice/voice.controller.js
const { generateTokenSchema } = require("./voice.schema");
const { generateLiveKitToken } = require("./voice.service");
const { getChannelById } = require("../channels/channels.repository");
const { pool } = require("../../db");
const env = require("../../config/env");

async function generateToken(req, res, next) {
  try {
    // Validar input
    const { channelId } = generateTokenSchema.parse(req.body);
    const userId = req.user.id; // De middleware authenticate

    // Verificar que canal existe
    const channel = await getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Verificar que es canal de voz
    if (channel.type !== "voice") {
      return res
        .status(400)
        .json({ error: "This channel is not a voice channel" });
    }

    // Verificar que usuario es miembro del servidor
    const memberQuery = `
      SELECT role FROM server_members 
      WHERE server_id = $1 AND user_id = $2
    `;
    const memberResult = await pool.query(memberQuery, [
      channel.server_id,
      userId,
    ]);
    if (memberResult.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not a member of this server" });
    }

    // Generar token LiveKit
    const token = await generateLiveKitToken(userId, channelId);

    res.json({
      token,
      livekitUrl: env.LIVEKIT_URL,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateToken,
};
```

- [ ] **Step 3: Crear archivo helper `voice.service.js`**

Crear en mismo directorio:

```js
// server/src/modules/voice/voice.service.js
const { AccessToken } = require("livekit-server-sdk");
const env = require("../../config/env");

async function generateLiveKitToken(userId, channelId) {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  // Configurar token
  at.identity = userId;
  at.name = userId; // Usar userId como nombre (se puede customizar con user info)
  at.addGrant({
    room: channelId, // room name = channel ID
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  return at.toJwt();
}

module.exports = {
  generateLiveKitToken,
};
```

- [ ] **Step 4: Crear `server/src/modules/voice/voice.routes.js`**

```js
// server/src/modules/voice/voice.routes.js
const express = require("express");
const { generateToken } = require("./voice.controller");
const { authenticate } = require("../../middleware/authenticate");
const { validate } = require("../../middleware/validate");
const { generateTokenSchema } = require("./voice.schema");

const router = express.Router();

// POST /api/voice/token
// Requiere autenticación y cuerpo { channelId }
router.post(
  "/token",
  authenticate,
  validate(generateTokenSchema),
  generateToken,
);

module.exports = router;
```

- [ ] **Step 5: Actualizar `server/src/app.js`**

Agregar montaje de rutas voice:

```js
// server/src/app.js
const voiceRoutes = require("./modules/voice/voice.routes");

// ... existing middleware ...

// Montar rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/servers", serversRoutes);
app.use("/api/channels", channelsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/voice", voiceRoutes); // 🆕

// ... error handler ...
```

- [ ] **Step 6: Verificar estructura**

Estructura de carpetas después de pasos:

```
server/src/modules/voice/
├── voice.controller.js
├── voice.routes.js
├── voice.schema.js
└── voice.service.js
```

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/voice/ server/src/app.js
git commit -m "feat: add voice module with LiveKit token generation"
```

---

## Task 5: Backend — Testing para Voice API

**Files:**

- Create: `server/__tests__/voice/voice.controller.test.js`
- Modify: `server/__tests__/channels/channels.integration.test.js`

- [ ] **Step 1: Crear `server/__tests__/voice/voice.controller.test.js`**

```js
// server/__tests__/voice/voice.controller.test.js
const request = require("supertest");
const app = require("../../src/app");
const pool = require("../../src/db");
const { signAccessToken } = require("../../src/config/jwt");

describe("Voice Controller", () => {
  let userId, serverId, voiceChannelId, textChannelId, accessToken;

  beforeAll(async () => {
    // Setup: crear usuario, servidor, canales
    process.env.NODE_ENV = "test";

    // Crear usuario
    const userRes = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser",
        email: "test@test.com",
        password: "Test123!",
      });
    userId = userRes.body.user.id;
    accessToken = userRes.body.accessToken;

    // Crear servidor
    const serverRes = await request(app)
      .post("/api/servers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "test-server", description: "Test" });
    serverId = serverRes.body.id;

    // Crear canal de voz
    const voiceRes = await request(app)
      .post(`/api/channels/${serverId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "general-voice", type: "voice" });
    voiceChannelId = voiceRes.body.id;

    // Crear canal de texto (para test negativo)
    const textRes = await request(app)
      .post(`/api/channels/${serverId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "general-text", type: "text" });
    textChannelId = textRes.body.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/voice/token", () => {
    - [ ] **test: genera token válido para canal de voz**() {
      const res = await request(app)
        .post("/api/voice/token")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ channelId: voiceChannelId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("livekitUrl");
      expect(res.body.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // JWT format
    });

    - [ ] **test: rechaza si channel no existe**() {
      const fakeChannelId = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .post("/api/voice/token")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ channelId: fakeChannelId });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    - [ ] **test: rechaza si channel es de tipo text**() {
      const res = await request(app)
        .post("/api/voice/token")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ channelId: textChannelId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not a voice channel/i);
    });

    - [ ] **test: rechaza si usuario no es miembro del servidor**() {
      // Crear usuario no miembro
      const otherRes = await request(app)
        .post("/api/auth/register")
        .send({
          username: "otheruser",
          email: "other@test.com",
          password: "Test123!",
        });
      const otherToken = otherRes.body.accessToken;

      const res = await request(app)
        .post("/api/voice/token")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ channelId: voiceChannelId });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not a member/i);
    });

    - [ ] **test: rechaza sin autenticación**() {
      const res = await request(app)
        .post("/api/voice/token")
        .send({ channelId: voiceChannelId });

      expect(res.status).toBe(401);
    };

    - [ ] **test: rechaza con channelId inválido (formato)**() {
      const res = await request(app)
        .post("/api/voice/token")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ channelId: "invalid-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid channel ID/i);
    });
  });
});
```

- [ ] **Step 2: Ejecutar tests voice**

```bash
cd server && npm test -- __tests__/voice/voice.controller.test.js
```

Expected: todos los tests pasan (6 tests).

- [ ] **Step 3: Actualizar tests de channels — verificar type**

En `server/__tests__/channels/channels.integration.test.js`:

```js
// Añadir test:
describe("Channel Type Support", () => {
  - [ ] **test: crea canal de tipo text por default**() {
    // Crear canal sin especificar type
    const res = await request(app)
      .post(`/api/channels/${serverId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "general" });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("text");
  });

  - [ ] **test: crea canal de tipo voice**() {
    const res = await request(app)
      .post(`/api/channels/${serverId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "general-voice", type: "voice" });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("voice");
  });

  - [ ] **test: rechaza tipo inválido**() {
    const res = await request(app)
      .post(`/api/channels/${serverId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "invalid", type: "invalid-type" });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Correr todos los tests backend**

```bash
npm test
```

Expected: todos los tests pasan (anterior + nuevos).

- [ ] **Step 5: Commit**

```bash
git add server/__tests__/
git commit -m "test: add voice controller and channel type tests"
```

---

## Task 6: Frontend — Instalar dependencias LiveKit

**Files:**

- Modify: `client/package.json`

- [ ] **Step 1: Instalar paquetes LiveKit**

```bash
cd client
npm install @livekit/components-react livekit-client
```

Expected: `node_modules/@livekit/` creado, versiones latest instaladas.

Verificar:

```bash
npm list @livekit/components-react livekit-client
```

- [ ] **Step 2: Verificar `package.json`**

Confirmar que paquetes están listados en `dependencies`:

```json
{
  "dependencies": {
    // ... existing ...
    "@livekit/components-react": "^0.x.x",
    "livekit-client": "^0.x.x"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add client/package.json
git commit -m "feat: add livekit dependencies to client"
```

---

## Task 7: Frontend — Componentes Voice (Nuevos)

**Files:**

- Create: `client/src/components/VoiceArea.jsx`
- Create: `client/src/components/ParticipantTile.jsx`
- Create: `client/src/components/VoiceControls.jsx`

- [ ] **Step 1: Crear `client/src/components/ParticipantTile.jsx`**

Componente individual para cada participante:

```jsx
// client/src/components/ParticipantTile.jsx
import React from "react";
import {
  VideoTrack,
  AudioTrack,
  ParticipantName,
} from "@livekit/components-react";
import { Participant } from "livekit-client";

export default function ParticipantTile({ participant }) {
  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
      {/* Video track */}
      {participant.videoTracks.length > 0 ? (
        <VideoTrack
          trackRef={participant.videoTracks[0]}
          className="w-full h-full object-cover"
        />
      ) : (
        // Fallback: Avatar con inicial
        <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-blue-500 to-purple-600">
          <span className="text-4xl font-bold text-white">
            {participant.name?.charAt(0).toUpperCase() || "U"}
          </span>
        </div>
      )}

      {/* Audio track (no visual) */}
      {participant.audioTracks.length > 0 && (
        <AudioTrack trackRef={participant.audioTracks[0]} />
      )}

      {/* Nombre superpuesto abajo */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <p className="text-sm font-medium text-white truncate">
          {participant.name || "Unknown User"}
        </p>
      </div>

      {/* Indicador muted (opcional) */}
      {participant.isMicrophoneEnabled === false && (
        <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1">
          <span className="text-white text-xs">🔇</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `client/src/components/VoiceControls.jsx`**

Barra de controles:

```jsx
// client/src/components/VoiceControls.jsx
import React, { useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";

export default function VoiceControls() {
  const { isLocalParticipantMuted, localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const [isMicMuted, setIsMicMuted] = useState(isLocalParticipantMuted);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const handleToggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicMuted);
      setIsMicMuted(!isMicMuted);
    }
  };

  const handleToggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  };

  const handleLeaveRoom = async () => {
    if (room) {
      await room.disconnect();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-center gap-4">
      {/* Mute Mic */}
      <button
        onClick={handleToggleMic}
        className={`px-4 py-2 rounded-full font-medium transition-colors ${
          isMicMuted
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
      >
        {isMicMuted ? "🔇 Unmute" : "🎙️ Mute"}
      </button>

      {/* Toggle Camera */}
      <button
        onClick={handleToggleCamera}
        className={`px-4 py-2 rounded-full font-medium transition-colors ${
          isCameraOn
            ? "bg-gray-700 hover:bg-gray-600 text-white"
            : "bg-red-600 hover:bg-red-700 text-white"
        }`}
      >
        {isCameraOn ? "📷 Camera On" : "📷 Camera Off"}
      </button>

      {/* Leave */}
      <button
        onClick={handleLeaveRoom}
        className="px-4 py-2 rounded-full font-medium bg-red-700 hover:bg-red-800 text-white transition-colors"
      >
        📞 Leave
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Crear `client/src/components/VoiceArea.jsx`**

Componente principal de área de voz:

```jsx
// client/src/components/VoiceArea.jsx
import React, { useEffect, useState } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
} from "@livekit/components-react";
import VoiceControls from "./VoiceControls";
import axios from "axios";

export default function VoiceArea({ channel, accessToken }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        setLoading(true);
        const response = await axios.post(
          "/api/voice/token",
          { channelId: channel.id },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        setToken(response.data.token);
        setLivekitUrl(response.data.livekitUrl);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch voice token");
        console.error("Token fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [channel.id, accessToken]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <div className="text-center">
          <p className="text-gray-300 mb-4">Connecting to voice channel...</p>
          <div className="animate-spin rounded-full h-12 w-12 border b-4 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <div className="bg-red-600/20 border border-red-600 rounded-lg p-4 max-w-sm">
          <p className="text-red-300 font-medium">Error</p>
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!token || !livekitUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-800">
        <p className="text-gray-300">Unable to establish connection</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-800 relative">
      {/* Channel Name Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <h2 className="text-xl font-bold text-white">🔊 {channel.name}</h2>
      </div>

      {/* LiveKit Room */}
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={livekitUrl}
        connectOptions={{
          autoSubscribe: true,
        }}
        className="flex-1 overflow-hidden"
      >
        <GridLayout className="h-full w-full bg-gray-900 gap-4 p-4">
          <ParticipantTile />
        </GridLayout>
      </LiveKitRoom>

      {/* Controls Overlay */}
      <VoiceControls />
    </div>
  );
}
```

- [ ] **Step 4: Verificar estructura**

```
client/src/components/
├── VoiceArea.jsx          ✨ nuevo
├── ParticipantTile.jsx    ✨ nuevo
└── VoiceControls.jsx      ✨ nuevo
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/{VoiceArea,ParticipantTile,VoiceControls}.jsx
git commit -m "feat: add voice components (VoiceArea, ParticipantTile, VoiceControls)"
```

---

## Task 8: Frontend — Actualizar Componentes Existentes

**Files:**

- Modify: `client/src/components/ChannelList.jsx`
- Modify: `client/src/pages/AppPage.jsx`

- [ ] **Step 1: Actualizar `client/src/components/ChannelList.jsx`**

Agregar diferenciación visual de tipos de canal:

```jsx
// client/src/components/ChannelList.jsx
import React, { useState } from "react";

export default function ChannelList({
  channels,
  servers,
  selectedServerId,
  onSelectChannel,
  onSelectVoiceChannel, // 🆕
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("text"); // 🆕

  // Separar canales por tipo
  const textChannels = channels?.filter((ch) => ch.type === "text") || [];
  const voiceChannels = channels?.filter((ch) => ch.type === "voice") || [];

  const handleCreate = async () => {
    if (!newChannelName.trim()) return;
    // Llamar a API para crear canal con type
    // onCreateChannel(newChannelName, newChannelType);
    setNewChannelName("");
    setNewChannelType("text");
    setShowCreateDialog(false);
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 overflow-y-auto">
      {/* Server Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-bold text-white">
          {servers?.find((s) => s.id === selectedServerId)?.name}
        </h3>
      </div>

      {/* Text Channels Section */}
      <div className="px-2 py-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase">
            Channels
          </h4>
          <button
            onClick={() => {
              setNewChannelType("text");
              setShowCreateDialog(true);
            }}
            className="text-gray-400 hover:text-white text-lg"
          >
            +
          </button>
        </div>
        {textChannels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 hover:text-white transition-colors"
          >
            # {channel.name}
          </button>
        ))}
      </div>

      {/* Voice Channels Section */}
      <div className="px-2 py-4 border-t border-gray-700">
        <div className="flex items-center justify-between px-2 mb-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase">Voice</h4>
          <button
            onClick={() => {
              setNewChannelType("voice");
              setShowCreateDialog(true);
            }}
            className="text-gray-400 hover:text-white text-lg"
          >
            +
          </button>
        </div>
        {voiceChannels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectVoiceChannel(channel)} // 🆕
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>🔊</span>
            <span>{channel.name}</span>
          </button>
        ))}
      </div>

      {/* Create Channel Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              Create Channel
            </h3>

            <input
              type="text"
              placeholder="Channel name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-4"
            />

            {/* Type selector */}
            <div className="mb-4">
              <label className="text-gray-300 text-sm mb-2 block">Type</label>
              <select
                value={newChannelType}
                onChange={(e) => setNewChannelType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="text"># Text</option>
                <option value="voice">🔊 Voice</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Actualizar `client/src/pages/AppPage.jsx`**

Agregar estado y condicional para VoiceArea:

```jsx
// client/src/pages/AppPage.jsx
import React, { useState } from "react";
import ServerList from "../components/ServerList";
import ChannelList from "../components/ChannelList";
import ChatArea from "../components/ChatArea";
import VoiceArea from "../components/VoiceArea"; // 🆕
import MessageInput from "../components/MessageInput";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

export default function AppPage() {
  const { user, accessToken } = useAuth();
  const { socket } = useSocket();

  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState(null); // 🆕
  const [servers, setServers] = useState([]);
  const [channels, setChannels] = useState([]);

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedVoiceChannel(null); // Limpiar voice channel
  };

  const handleSelectVoiceChannel = (channel) => {
    // 🆕
    setSelectedVoiceChannel(channel);
    setSelectedChannel(null); // Limpiar text channel
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebars */}
      <ServerList servers={servers} onSelectServer={setSelectedServer} />
      <ChannelList
        channels={channels}
        servers={servers}
        selectedServerId={selectedServer?.id}
        onSelectChannel={handleSelectChannel}
        onSelectVoiceChannel={handleSelectVoiceChannel} // 🆕
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Mostrar según tipo de canal */}
        {selectedVoiceChannel ? (
          <VoiceArea channel={selectedVoiceChannel} accessToken={accessToken} />
        ) : selectedChannel ? (
          <>
            <ChatArea channel={selectedChannel} />
            <MessageInput
              channelId={selectedChannel?.id}
              server={selectedServer}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Select a channel to start</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ChannelList.jsx client/src/pages/AppPage.jsx
git commit -m "feat: update channel list and app page for voice channel support"
```

---

## Task 9: Frontend — Estilos CSS para Video Grid

**Files:**

- Modify: `client/src/index.css`

- [ ] **Step 1: Actualizar `client/src/index.css`**

Agregar estilos para grid de video:

```css
/* client/src/index.css */

/* Estilos existentes de Tailwind ... */

/* Voice Room Styles */
.lk-room {
  @apply w-full h-full bg-gray-900;
}

.lk-grid-layout {
  @apply gap-4 p-4 bg-gray-900;
}

/* Participant Tile */
.lk-participant-tile {
  @apply rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow;
  aspect-ratio: 16 / 9;
}

.lk-participant-tile video {
  @apply w-full h-full object-cover;
}

/* Custom grid responsive */
@media (min-width: 1920px) {
  .lk-grid-layout {
    @apply grid grid-cols-4;
  }
}

@media (min-width: 1280px) and (max-width: 1919px) {
  .lk-grid-layout {
    @apply grid grid-cols-3;
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .lk-grid-layout {
    @apply grid grid-cols-2;
  }
}

@media (max-width: 767px) {
  .lk-grid-layout {
    @apply grid grid-cols-1;
  }
}

/* Loading spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Voice controls footer */
.voice-controls {
  @apply fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700;
  padding: 1rem 1.5rem;
  z-index: 50;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "style: add voice room and grid layout styles"
```

---

## Task 10: Integración & Testing Manual

**Files:** (sin nuevos archivos, tests manuales)

- [ ] **Step 1: Asegurar que toda la app está runnable**

```bash
# Backend
cd server
npm test # Pasar todos los tests
npm run dev # Levantar servidor (Ctrl+C después)

# Frontend
cd ../client
npm run dev # Levantar frontend (Ctrl+C después)
```

- [ ] **Step 2: Levantar stack completo**

```bash
# Terminal 1: Docker
docker compose up -d

# Terminal 2: Backend
cd server && npm run dev

# Terminal 3: Frontend
cd client && npm run dev
```

Expected:

- Backend en http://localhost:4000
- Frontend en http://localhost:5173
- LiveKit en http://localhost:7880

- [ ] **Step 3: Flujo manual end-to-end**

1. Abrir http://localhost:5173
2. Register + Login
3. Crear servidor
4. Crear canal de voz (tipo = "voice")
5. Hacer clic en canal de voz
6. Debería mostrar VoiceArea
7. Pedir permisos de cámara/micrófono
8. Ver grid de video (con avatar fallback si no hay cámara)
9. Botones de control: mute, camera, leave funcionan

- [ ] **Step 4: Tests end-to-end (Playwright/Cypress)**

Create `client/e2e/voice-channel.spec.js` (optional, pseudo-code):

```js
// Pseudo-code para E2E test
test("User can join and interact in voice channel", async ({ browser }) => {
  // 1. Register y login
  // 2. Create server
  // 3. Create voice channel
  // 4. Click on voice channel
  // 5. Expect VoiceArea to render
  // 6. Expect GridLayout with participants
  // 7. Click mute button - verify muted state
  // 8. Click camera button - verify camera toggle
  // 9. Click leave button - verify disconnect
});
```

- [ ] **Step 5: Verificar errores en consola**

- Backend: `npm run dev` no debe mostrar errores
- Frontend: `npm run dev` no debe mostrar errores critical en dev tools
- LiveKit: `docker logs connect-chat-livekit` para verificar conexiones

- [ ] **Step 6: Documentar issues**

Cualquier issue encontrado en testing:

- Errores de conexión LiveKit
- Token no válido
- Permisos de cámara/micrófono
- UI responsive issues
- Audio/video sync issues

- [ ] **Step 7: Commit de cambios si hay fixes**

```bash
git add .
git commit -m "fix: resolve voice channel integration issues"
```

---

## Task 11: Final Cleanup & Documentation

**Files:**

- Update: `README.md` (si existe)
- Create: `VOICE_CHANNEL_SETUP.md` (opcional)

- [ ] **Step 1: Actualizar `.env.example`**

Verificar que incluye todas las vars necesarias:

```bash
# Voice/LiveKit vars presentes en .env
grep -E "LIVEKIT_" .env.example
```

- [ ] **Step 2: Documentar setup de Phase 2**

Create `VOICE_CHANNEL_SETUP.md`:

````markdown
# Voice Channel Setup Guide

## Prerequisites

- Docker (con docker-compose)
- Node.js 18+
- PostgreSQL 16 (via Docker)

## Installation

1. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
````

2. Setup environment:

   ```bash
   cp .env.example .env
   ```

3. Run migrations:

   ```bash
   cd server
   node src/db/migrate.js
   ```

4. Start services:

   ```bash
   # Terminal 1
   docker compose up -d

   # Terminal 2
   cd server && npm run dev

   # Terminal 3
   cd client && npm run dev
   ```

5. Access:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:4000
   - LiveKit: ws://localhost:7880

## Features

- Text channels (# prefix)
- Voice channels (🔊 prefix)
- Real-time voice/video via LiveKit
- Grid layout for video
- Mute/unmute, camera toggle
- Leave room gracefully

## Troubleshooting

- LiveKit not connecting: `docker compose logs livekit`
- DB migration issues: `MIGRATE_TEST=1 npm run migrate`
- Token generation errors: Check `LIVEKIT_API_KEY` env var

````

- [ ] **Step 2: Verificar README principal**

Si existe `README.md`, agregar referencia:

```markdown
## Phase 2 — Voice/Video Channels
- See [VOICE_CHANNEL_SETUP.md](./VOICE_CHANNEL_SETUP.md) for setup instructions
- Voice channels create real-time communication via LiveKit
- Users can see video grid, control audio/video, leave channels
````

- [ ] **Step 3: Final git log**

```bash
git log --oneline | head -10
```

Expected output similar a:

```
abc1234 docs: add voice channel setup guide
def5678 style: add voice room and grid layout styles
ghi9012 feat: update channel list and app page for voice support
jkl3456 feat: add voice components (VoiceArea, ParticipantTile, etc)
...
```

- [ ] **Step 4: Final commit**

```bash
git add README.md VOICE_CHANNEL_SETUP.md
git commit -m "docs: add voice channel documentation and setup guide"
```

---

## Checklist de Validación Final

- [ ] Backend tests: `npm test` ✅ (todos pasan)
- [ ] Backend dev server: `npm run dev` ✅ (sin errores)
- [ ] Frontend dev server: `npm run dev` ✅ (sin errores)
- [ ] Docker services: `docker compose ps` ✅ (3 containers running)
- [ ] Migrations ejecutadas: `psql` → `\d channels` ✅ (columna `type` presente)
- [ ] E2E flow: Register → Create Server → Create Voice Channel → Join Channel ✅
- [ ] Voice/video streaming: Micrófono + cámara activos ✅
- [ ] Controls: Mute/unmute, camera toggle, leave funcionan ✅
- [ ] Responsive UI: Grid ajusta en diferentes resoluciones ✅
- [ ] Error handling: Conecta, desconecta, reconnecta gracefully ✅

---

## Estimación de Tiempo

| Tarea                                 | Tiempo    |
| ------------------------------------- | --------- |
| Task 1: Docker setup                  | 0.5h      |
| Task 2: DB migrations                 | 0.5h      |
| Task 3: Backend channels update       | 1h        |
| Task 4: Voice module backend          | 2h        |
| Task 5: Backend testing               | 1.5h      |
| Task 6: Frontend dependencies         | 0.3h      |
| Task 7: Voice components (new)        | 2.5h      |
| Task 8: Update existing components    | 1.5h      |
| Task 9: CSS styling                   | 1h        |
| Task 10: Integration & manual testing | 2h        |
| Task 11: Documentation                | 1h        |
| **Total**                             | **13.8h** |

---

## Arquitectura Técnica

### Backend Flow

```text
POST /api/voice/token
↓
authenticate middleware (verificar JWT)
↓
validate schema (channelId)
↓
repository: getChannelById (verificar existe y es voice)
↓
repository: getServerMember (verificar membresía)
↓
service: generateLiveKitToken (firmar token con LiveKit SDK)
↓
Response: { token, livekitUrl } (JSON)
```

### Frontend Flow

```text
User clicks voice channel
↓
AppPage: setSelectedVoiceChannel
↓
VoiceArea mounts
↓
Fetch POST /api/voice/token
↓
LiveKitRoom component con token
↓
Conecta a LiveKit SFU
↓
GridLayout de participantes
↓
VoiceControls para mute/camera/leave
```

### LiveKit Architecture

```text
Client A (WebRTC)  ─┐
Client B (WebRTC)  ─┼─→ LiveKit SFU (Media Router)
Client C (WebRTC)  ─┘
                       └→ Broadcast video/audio entre participants
```

---

## Referencias

- LiveKit Docs: https://docs.livekit.io
- LiveKit React Components: https://github.com/livekit/livekit-react
- Phase 1 Spec: `2026-05-09-connect-chat-phase1.md`
- Design Spec: `docs/superpowers/specs/2026-05-09-phase2-webrtc-design.md`
