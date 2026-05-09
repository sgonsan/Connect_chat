# Connect Chat

A Discord-inspired real-time chat application with text channels, voice/video rooms, role-based permissions, and shareable invite links.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + CSS custom properties |
| Backend | Node.js + Express + Socket.IO |
| Database | PostgreSQL 16 |
| Voice/Video | LiveKit SFU (Docker) |
| Auth | JWT (Bearer token) |

---

## Setup

### Prerequisites

- Node.js 18+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/sgonsan/Connect_chat.git
cd Connect_chat
cd server && npm install
cd ../client && npm install
```

### 2. Environment

```bash
cd server
cp .env.example .env   # or create manually
```

Minimum required variables in `server/.env`:

```env
JWT_SECRET=your_secret_here
DATABASE_URL=postgresql://connectchat:connectchat@localhost:5432/connectchat
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
ALLOWED_ORIGIN=http://localhost:4000
```

### 3. Start Docker services

```bash
docker compose up -d
```

Starts PostgreSQL (port 5432), PostgreSQL test DB (port 5433), and LiveKit SFU (port 7880).

### 4. Run migrations

```bash
cd server && npm run migrate
```

### 5. Start the app

```bash
# Development
cd server && npm run dev        # API on :4000
cd client && npm run dev        # Vite dev server on :5173

# Production (serves built frontend from Express)
cd client && npm run build
cd server && npm start
```

---

## Features

### Servers & Channels
- Create or join servers
- Text channels (real-time via Socket.IO) and voice channels (WebRTC via LiveKit)
- Messages grouped by author within 5-minute windows

### Roles & Permissions

| Action | Member | Moderator | Owner |
|---|:---:|:---:|:---:|
| Send messages | ✓ | ✓ | ✓ |
| Create/delete channels | | ✓ | ✓ |
| Delete any message | | ✓ | ✓ |
| Kick members | | ✓ | ✓ |
| Generate invite links | | ✓ | ✓ |
| Promote/demote roles | | | ✓ |

### Invite Links
- Generate links with optional expiry (1h / 12h / 24h / 7d / never) and max-use limit
- Public preview page at `/invite/:code` — shows server info before joining
- Atomic join transaction prevents race conditions on limited-use invites

### Voice & Video
- Click any voice channel to join — camera and microphone are requested
- Video grid with participant tiles
- Controls: mute, toggle camera, leave room

> **Note:** `getUserMedia` requires HTTPS or `localhost`. For LAN/homelab access over HTTP, enable the Chrome flag:  
> `chrome://flags/#unsafely-treat-insecure-origin-as-secure`

---

## Project Structure

```
Connect_chat/
├── docker-compose.yml
├── server/
│   └── src/
│       ├── app.js
│       ├── db/
│       │   ├── migrate.js
│       │   └── migrations/
│       │       ├── 001_init.sql
│       │       ├── 002_add_channel_type.sql
│       │       └── 003_roles_invites.sql
│       ├── middleware/
│       │   ├── authenticate.js
│       │   └── hasRole.js
│       └── modules/
│           ├── auth/
│           ├── channels/
│           ├── invites/
│           ├── messages/
│           ├── servers/
│           └── voice/
└── client/
    └── src/
        ├── components/
        │   ├── ServerList.jsx
        │   ├── ChannelList.jsx
        │   ├── ChatArea.jsx
        │   ├── MemberList.jsx
        │   ├── MessageInput.jsx
        │   └── InviteModal.jsx
        └── pages/
            ├── LoginPage.jsx
            └── InvitePage.jsx
```

---

## Testing

```bash
docker compose up -d          # test DB must be running
cd server && npm test
```

---

## Deployment (LXC / self-hosted)

```bash
cd /opt/Connect_chat && git pull
cd server && npm install && npm run migrate
cd ../client && npm run build
pm2 restart all
```

LiveKit requires UDP port 7882 open on the host for WebRTC media.
