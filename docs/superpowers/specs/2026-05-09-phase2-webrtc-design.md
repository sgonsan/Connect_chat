# Connect Chat — Diseño Fase 2: Video/Audio WebRTC

**Fecha:** 2026-05-09
**Proyecto:** Connect Chat — Mini clon de Discord
**Fase:** 2 — Canales de voz y video en tiempo real

---

## 1. Resumen

Añadir canales de voz/video a la aplicación. Los usuarios pueden unirse a un canal de voz y comunicarse con audio y cámara en tiempo real con hasta 5+ participantes simultáneos. Al entrar al canal de voz, el área de chat es reemplazada por una grilla de video al estilo Discord.

**Fuera de alcance en Fase 2:** compartir pantalla (Fase 3), grabación, roles de moderador, canales de voz con límite de participantes configurables.

---

## 2. Stack adicional

| Componente | Tecnología |
|---|---|
| SFU (media server) | LiveKit (Docker container) |
| Backend SDK | `livekit-server-sdk` (Node.js) |
| Frontend SDK | `@livekit/components-react` + `livekit-client` |
| Señalización | LiveKit WebSocket interno (no Socket.IO) |

LiveKit se agrega al `docker-compose.yml` existente. El backend genera tokens de acceso LiveKit usando el SDK oficial. El frontend se conecta directamente a LiveKit para toda la comunicación de medios.

---

## 3. Cambios al modelo de datos

### Modificar tabla `channels`

Agregar columna `type` para distinguir canales de texto y voz:

```sql
ALTER TABLE channels ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'text'
  CHECK (type IN ('text', 'voice'));
```

Migración: `002_add_channel_type.sql`

No hay nuevas tablas. LiveKit gestiona el estado de las salas en memoria (sin persistencia en DB).

---

## 4. Arquitectura

```
Cliente React
  ├── HTTP/REST  ──► Node.js → token LiveKit (POST /api/voice/token)
  └── WebRTC     ──► LiveKit SFU (:7880) — audio/video directo

LiveKit SFU
  └── Gestiona rooms, tracks, participantes en memoria

Node.js Backend
  └── Solo genera tokens firmados — no toca los medios
```

### Flujo de conexión a un canal de voz

1. Usuario hace clic en canal de voz en el sidebar
2. Frontend llama `POST /api/voice/token` con `{ channelId }`
3. Backend verifica membresía del servidor, genera token LiveKit con `roomName = channelId`
4. Frontend usa el token para conectarse a la room de LiveKit
5. LiveKit gestiona la sala (participantes, tracks, reconexión)
6. Al salir, frontend llama `disconnect()` en el cliente LiveKit

---

## 5. API REST nueva

### Autenticado — miembro del servidor

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/voice/token` | `{ channelId }` | `{ token, livekitUrl }` |

El token LiveKit tiene TTL corto (1 hora). El endpoint verifica que el canal exista, sea de tipo `voice`, y que el usuario sea miembro del servidor al que pertenece el canal.

---

## 6. Cambios al backend existente

### `channels.schema.js`
Agregar `type` al schema de creación:
```js
const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  type: z.enum(['text', 'voice']).default('text'),
});
```

### `channels.repository.js`
Pasar `type` al INSERT de `createChannel`.

### Nuevo módulo: `server/src/modules/voice/`
- `voice.controller.js` — genera token LiveKit
- `voice.routes.js` — POST `/api/voice/token`, requiere `authenticate`
- Montado en `app.js` como `/api/voice`

### `docker-compose.yml`
Agregar servicio LiveKit:
```yaml
livekit:
  image: livekit/livekit-server:latest
  ports:
    - "7880:7880"
    - "7881:7881"
    - "7882:7882/udp"
  command: --dev
  environment:
    - LIVEKIT_KEYS=devkey:secret
```

### Variables de entorno (`.env`)
```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

---

## 7. Cambios al frontend existente

### `ChannelList.jsx`
- Mostrar canales de texto (#) y voz (🔊) en secciones separadas
- Al crear canal, elegir tipo texto o voz
- Al hacer clic en canal de voz → llamar a `onSelectVoice(channel)` en lugar de `onSelect`

### `AppPage.jsx`
- Nuevo estado: `selectedVoiceChannel`
- Si `selectedVoiceChannel` está activo → renderizar `<VoiceArea>` en lugar de `<ChatArea>`

### Nuevos componentes

**`client/src/components/VoiceArea.jsx`**
- Fetch token `POST /api/voice/token`
- Conectar con `LiveKitRoom` del SDK
- Grid de participantes con `VideoTrack` / avatar fallback
- Barra de controles: mute mic, toggle cámara, colgar

**`client/src/components/ParticipantTile.jsx`**
- Tile individual: video si cámara activa, avatar (inicial) si no
- Nombre del participante superpuesto abajo

---

## 8. Estructura de archivos nueva

```
server/src/
├── db/migrations/
│   └── 002_add_channel_type.sql
└── modules/voice/
    ├── voice.controller.js
    └── voice.routes.js

client/src/components/
├── VoiceArea.jsx
└── ParticipantTile.jsx
```

---

## 9. Roadmap de fases

| Fase | Contenido |
|---|---|
| **1 (completa)** | Auth, servidores, canales de texto, mensajería, Socket.IO |
| **2 (este spec)** | Canales de voz/video con LiveKit, grilla de participantes |
| **3** | Compartir pantalla + encapsulado Electron |
