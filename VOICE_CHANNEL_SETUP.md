# Voice Channel Setup Guide

## Prerequisites

- Docker Desktop (with docker-compose)
- Node.js 18+
- PostgreSQL 16 (via Docker)

## Installation

1. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. Setup environment:
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET and DATABASE_URL
   ```

3. Start Docker services (includes LiveKit):
   ```bash
   docker compose up -d
   ```

4. Run migrations:
   ```bash
   cd server
   node src/db/migrate.js
   ```

5. Start the app:
   ```bash
   # Terminal 1 — Backend
   cd server && npm run dev

   # Terminal 2 — Frontend
   cd client && npm run dev
   ```

6. Access:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:4000
   - LiveKit: ws://localhost:7880

## Features

- Text channels (`#` prefix) — real-time messaging via Socket.IO
- Voice channels (`🔊` prefix) — real-time voice/video via LiveKit SFU
- Video grid layout with participant tiles
- Mute/unmute microphone
- Toggle camera on/off
- Leave room gracefully

## Architecture

```
Client (React) ──POST /api/voice/token──► Backend (Express)
                                                │
                                         Validates channel
                                         Checks membership
                                         Signs LiveKit JWT
                                                │
Client ◄─────────────{ token, livekitUrl }──────┘
   │
   └──WebRTC──► LiveKit SFU (Docker) ◄──WebRTC── Other clients
```

## Troubleshooting

- **LiveKit not connecting**: `docker compose logs livekit`
- **DB migration issues**: Check `DATABASE_URL` in `.env`, then re-run `node src/db/migrate.js`
- **Token generation errors**: Verify `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` match `LIVEKIT_KEYS` in docker-compose.yml
- **Build errors**: `cd client && npm install` then `npm run build`
