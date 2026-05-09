# Connect Chat — Diseño Fase 1

**Fecha:** 2026-05-09  
**Proyecto:** Mini clon de Discord (web encapsulable)  
**Fase:** 1 — Usuarios, Servidores, Canales, Mensajería persistente  

---

## 1. Resumen

Aplicación web de chat en tiempo real inspirada en Discord. El frontend es una SPA React/Vite minimalista diseñada para ser encapsulada en Electron en el futuro. El foco está en el backend: API REST segura, WebSockets con Socket.IO, y persistencia completa en PostgreSQL.

**Fuera de alcance en Fase 1:** video/audio, roles granulares, mensajes directos (DMs), categorías de canales, notificaciones push, encapsulado Electron.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Tiempo real | Socket.IO |
| Base de datos | PostgreSQL |
| Autenticación | JWT (access) + Refresh Token (cookie HttpOnly) |
| Validación | zod |
| Seguridad HTTP | Helmet.js, express-rate-limit, CORS |
| Frontend | React + Vite + Tailwind CSS |
| Entorno local | docker-compose (PostgreSQL) |

---

## 3. Arquitectura

Monolito modular en un único proceso Node.js. La API REST y el gateway Socket.IO comparten la misma capa de servicios y repositorios.

```
Cliente (React SPA)
  ├── HTTP/REST  ──► Router → Controller → Service → Repository → PostgreSQL
  └── WebSocket  ──► Socket.IO Gateway   → Service → Repository → PostgreSQL
```

### Estructura de carpetas

```
connect-chat/
├── server/
│   └── src/
│       ├── config/           # db, env, jwt
│       ├── middleware/        # authenticate, authorize, rateLimiter, errorHandler
│       ├── modules/
│       │   ├── auth/          # register, login, refresh, logout
│       │   ├── users/         # perfil propio
│       │   ├── servers/       # CRUD + membresía + invite
│       │   ├── channels/      # CRUD (solo owner)
│       │   └── messages/      # historial paginado + borrar
│       ├── socket/            # gateway WS + handlers de eventos
│       └── db/                # pool pg + migrations
└── client/
    └── src/
        ├── pages/             # Login, Register, App
        ├── components/        # ServerList, ChannelList, ChatArea
        └── socket.js          # instancia Socket.IO client
```

Cada módulo sigue la misma estructura interna: `routes → controller → service → repository`.

---

## 4. Modelo de Datos

### Tablas

**users**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
username    VARCHAR(32) UNIQUE NOT NULL
email       VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL          -- bcrypt cost 12
avatar_url  VARCHAR(500)
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**servers**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(100) NOT NULL
description VARCHAR(500)
owner_id    UUID NOT NULL REFERENCES users(id)
invite_code UUID UNIQUE DEFAULT gen_random_uuid()  -- para unirse sin exponer ID
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**server_members**
```sql
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
server_id   UUID REFERENCES servers(id) ON DELETE CASCADE
role        VARCHAR(10) NOT NULL DEFAULT 'member'   -- 'owner' | 'member'
joined_at   TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (user_id, server_id)
```

**channels**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE
name        VARCHAR(100) NOT NULL
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**messages**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id)
content     VARCHAR(2000) NOT NULL
created_at  TIMESTAMPTZ DEFAULT NOW()
edited_at   TIMESTAMPTZ                             -- NULL si no fue editado
```

**refresh_tokens**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash  VARCHAR(255) UNIQUE NOT NULL             -- SHA-256 del token raw
expires_at  TIMESTAMPTZ NOT NULL
revoked_at  TIMESTAMPTZ                             -- NULL = activo
```

### Índices

```sql
CREATE INDEX ON messages(channel_id, created_at DESC);
CREATE INDEX ON server_members(user_id, server_id);
CREATE INDEX ON users(email);
CREATE INDEX ON refresh_tokens(token_hash);
```

---

## 5. API REST

Todos los endpoints excepto auth requieren header `Authorization: Bearer <access_token>`.

### Auth — público

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, email, password }` | `{ user, access_token }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, access_token }` + cookie |
| POST | `/api/auth/refresh` | — (lee cookie) | `{ access_token }` |
| POST | `/api/auth/logout` | — | `204` |

El refresh token se entrega en cookie `HttpOnly; SameSite=Strict; Secure`.

### Users — autenticado

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users/me` | Perfil propio |
| PATCH | `/api/users/me` | Actualizar username o avatar |

### Servers — autenticado

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/servers` | Servidores a los que pertenece el usuario |
| POST | `/api/servers` | Crear servidor (creador queda como owner) |
| GET | `/api/servers/:id` | Detalle + canales (solo miembros) |
| DELETE | `/api/servers/:id` | Eliminar servidor (solo owner) |
| POST | `/api/servers/join` | Unirse con `{ invite_code }` |
| DELETE | `/api/servers/:id/leave` | Abandonar servidor (owner no puede) |

### Channels — miembro del servidor

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/servers/:id/channels` | Crear canal (solo owner) |
| DELETE | `/api/channels/:id` | Eliminar canal (solo owner) |

### Messages — miembro del servidor

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/channels/:id/messages` | Historial paginado `?before=<id>&limit=50` |
| DELETE | `/api/messages/:id` | Borrar propio mensaje (también emite `message:deleted` por Socket.IO) |

---

## 6. WebSocket — Socket.IO

### Conexión
```js
// El cliente pasa el access_token en el handshake
const socket = io(SERVER_URL, { auth: { token: access_token } });
```
El gateway valida el JWT antes de aceptar la conexión. Si el token expiró, el cliente debe hacer refresh vía REST primero.

### Eventos Cliente → Servidor

| Evento | Payload | Descripción |
|---|---|---|
| `channel:join` | `{ channelId }` | Entrar a la room del canal (verifica membresía) |
| `channel:leave` | `{ channelId }` | Salir de la room |
| `message:send` | `{ channelId, content }` | Enviar mensaje (guarda en DB y hace broadcast) |
| `message:delete` | `{ messageId }` | Borrar propio mensaje |

### Eventos Servidor → Cliente

| Evento | Payload | Descripción |
|---|---|---|
| `message:new` | `{ id, channelId, user, content, createdAt }` | Nuevo mensaje en un canal |
| `message:deleted` | `{ messageId, channelId }` | Mensaje eliminado |
| `error` | `{ code, message }` | Error de operación WS |

---

## 7. Seguridad

### Pipeline de cada request
```
request → rateLimiter → authenticate → authorize → controller → service → repository
```

### Medidas por capa

**Transporte**
- Helmet.js — headers HTTP seguros (CSP, HSTS, X-Frame-Options, etc.)
- CORS restringido al origen del cliente (`ALLOWED_ORIGIN` en env)
- HTTPS obligatorio en producción

**Autenticación**
- Passwords: bcrypt con cost factor 12
- Access JWT: HS256, TTL 15 minutos, firmado con `JWT_SECRET` de 256 bits
- Refresh token: UUID v4 random, almacenado como SHA-256 en DB, enviado en cookie `HttpOnly; SameSite=Strict; Secure`, TTL 7 días
- El access token se guarda en memoria del cliente (no en `localStorage`) — protección contra XSS

**Autorización**
- `authenticate` — verifica y decodifica el JWT, adjunta `req.user`
- `isMember` — verifica que `req.user` sea miembro del servidor antes de cada operación
- `isOwner` — verifica que `req.user` sea owner para operaciones destructivas
- Socket.IO: membresía verificada en `channel:join`

**Rate limiting**
- Global: 100 req/min por IP
- Auth endpoints: 10 req/min por IP

**Validación de inputs**
- Todos los endpoints validan con schemas zod antes de llegar al controller
- Queries parametrizadas en todos los repositorios — sin concatenación SQL
- Longitud máxima de mensajes: 2000 caracteres

---

## 8. Frontend (mínimo)

Tres vistas:

- `/login` — formulario email + password
- `/register` — formulario username + email + password
- `/app` — vista principal:

```
┌─────────┬────────────┬──────────────────────────┐
│ Servers │  Channels  │      Chat Area           │
│  list   │   list     │  historial + input       │
└─────────┴────────────┴──────────────────────────┘
```

**Componentes:** `ServerList`, `ChannelList`, `ChatArea`, `MessageInput`.  
**Estado global:** React Context (sin Redux ni Zustand — innecesario para esta escala).  
**Socket.IO client:** instancia única compartida vía Context.  

---

## 9. Roadmap de fases

| Fase | Contenido |
|---|---|
| **1 (este spec)** | Auth, usuarios, servidores, canales, mensajería persistente, seguridad |
| **2** | Video/audio en tiempo real (WebRTC + canales de voz) |
| **3** | Encapsulado Electron para desktop |
