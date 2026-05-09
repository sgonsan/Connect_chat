# Graph Report - .  (2026-05-09)

## Corpus Check
- Corpus is ~11,555 words - fits in a single context window. You may not need a graph.

## Summary
- 41 nodes · 78 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Data Model & ServersChannels|Data Model & Servers/Channels]]
- [[_COMMUNITY_Authorization Middleware|Authorization Middleware]]
- [[_COMMUNITY_REST API & Design Spec|REST API & Design Spec]]
- [[_COMMUNITY_Implementation Plan & Database|Implementation Plan & Database]]
- [[_COMMUNITY_Auth & Token Security|Auth & Token Security]]
- [[_COMMUNITY_Frontend & Dev Setup|Frontend & Dev Setup]]
- [[_COMMUNITY_Real-Time Messaging|Real-Time Messaging]]
- [[_COMMUNITY_Product Roadmap|Product Roadmap]]
- [[_COMMUNITY_Project Config & Graphify|Project Config & Graphify]]
- [[_COMMUNITY_Backend Architecture|Backend Architecture]]

## God Nodes (most connected - your core abstractions)
1. `Connect Chat — Discord Clone Design Spec (Phase 1)` - 33 edges
2. `Connect Chat — Phase 1 Implementation Plan` - 12 edges
3. `DB Migration: 001_init.sql` - 8 edges
4. `Socket.IO WebSocket Gateway` - 6 edges
5. `JWT Authentication (Access + Refresh Token)` - 6 edges
6. `React + Vite Frontend SPA` - 5 edges
7. `Security Request Pipeline` - 5 edges
8. `Node.js + Express Backend` - 4 edges
9. `DB Table: refresh_tokens` - 4 edges
10. `Module: auth (register, login, refresh, logout)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Task 1: Project Scaffold` --references--> `Node.js + Express Backend`  [INFERRED]
  docs/superpowers/plans/2026-05-09-connect-chat-phase1.md → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `Connect Chat — Phase 1 Implementation Plan` --references--> `Connect Chat — Discord Clone Design Spec (Phase 1)`  [EXTRACTED]
  docs/superpowers/plans/2026-05-09-connect-chat-phase1.md → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `Connect Chat — Phase 1 Implementation Plan` --references--> `Node.js + Express Backend`  [EXTRACTED]
  docs/superpowers/plans/2026-05-09-connect-chat-phase1.md → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `Connect Chat — Phase 1 Implementation Plan` --references--> `Socket.IO WebSocket Gateway`  [EXTRACTED]
  docs/superpowers/plans/2026-05-09-connect-chat-phase1.md → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `Connect Chat — Phase 1 Implementation Plan` --references--> `PostgreSQL Database`  [EXTRACTED]
  docs/superpowers/plans/2026-05-09-connect-chat-phase1.md → docs/superpowers/specs/2026-05-09-discord-clone-design.md

## Hyperedges (group relationships)
- **Backend Core Stack: Node.js + Express + Socket.IO + PostgreSQL** — nodejs_express, socketio_gateway, postgresql_db [EXTRACTED 1.00]
- **Security Middleware Triad: authenticate + isMember + isOwner** — middleware_authenticate, middleware_ismember, middleware_isowner [EXTRACTED 1.00]
- **Core Data Model Entities: users + servers + channels + messages** — data_model_users, data_model_servers, data_model_channels, data_model_messages [EXTRACTED 1.00]

## Communities (10 total, 2 thin omitted)

### Community 0 - "Data Model & Servers/Channels"
Cohesion: 0.33
Nodes (7): DB Table: channels, DB Table: server_members, DB Table: servers, DB Table: users, DB Migration: 001_init.sql, Module: channels (CRUD owner-only), Module: servers (CRUD + membership + invite)

### Community 1 - "Authorization Middleware"
Cohesion: 0.4
Nodes (5): Middleware: authenticate (JWT verify), Middleware: isMember (server membership check), Middleware: isOwner (owner-only operations), express-rate-limit Rate Limiting, Security Request Pipeline

### Community 2 - "REST API & Design Spec"
Cohesion: 0.4
Nodes (5): Connect Chat — Discord Clone Design Spec (Phase 1), Helmet.js HTTP Security Headers, Module: users (profile), REST API Endpoints, Zod Input Validation

### Community 3 - "Implementation Plan & Database"
Cohesion: 0.5
Nodes (5): Environment Config (env.js), Connect Chat — Phase 1 Implementation Plan, PostgreSQL Database, Superpowers: Subagent-Driven Development, Task 2: Database Migration and Pool

### Community 4 - "Auth & Token Security"
Cohesion: 0.67
Nodes (4): Bcrypt Password Hashing (cost 12), DB Table: refresh_tokens, JWT Authentication (Access + Refresh Token), Module: auth (register, login, refresh, logout)

### Community 5 - "Frontend & Dev Setup"
Cohesion: 0.5
Nodes (4): Docker Compose (PostgreSQL local env), React Context Global State (no Redux), React + Vite Frontend SPA, Task 1: Project Scaffold

### Community 6 - "Real-Time Messaging"
Cohesion: 0.5
Nodes (4): DB Table: messages, Module: messages (paginated history + delete), Socket.IO WebSocket Gateway, WebSocket Socket.IO Events

### Community 7 - "Product Roadmap"
Cohesion: 0.67
Nodes (3): Connect Chat Application, Phase 2: WebRTC Video/Audio, Phase 3: Electron Desktop Encapsulation

## Knowledge Gaps
- **7 isolated node(s):** `CLAUDE.md — Project Instructions`, `Graphify Knowledge Graph`, `Zod Input Validation`, `Helmet.js HTTP Security Headers`, `REST API Endpoints` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Connect Chat — Discord Clone Design Spec (Phase 1)` connect `REST API & Design Spec` to `Data Model & Servers/Channels`, `Authorization Middleware`, `Implementation Plan & Database`, `Auth & Token Security`, `Frontend & Dev Setup`, `Real-Time Messaging`, `Product Roadmap`, `Backend Architecture`?**
  _High betweenness centrality (0.717) - this node is a cross-community bridge._
- **Why does `Connect Chat — Phase 1 Implementation Plan` connect `Implementation Plan & Database` to `Data Model & Servers/Channels`, `REST API & Design Spec`, `Auth & Token Security`, `Frontend & Dev Setup`, `Real-Time Messaging`, `Backend Architecture`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `DB Migration: 001_init.sql` connect `Data Model & Servers/Channels` to `Implementation Plan & Database`, `Auth & Token Security`, `Real-Time Messaging`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Socket.IO WebSocket Gateway` (e.g. with `WebSocket Socket.IO Events` and `JWT Authentication (Access + Refresh Token)`) actually correct?**
  _`Socket.IO WebSocket Gateway` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `JWT Authentication (Access + Refresh Token)` (e.g. with `DB Table: refresh_tokens` and `Middleware: authenticate (JWT verify)`) actually correct?**
  _`JWT Authentication (Access + Refresh Token)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CLAUDE.md — Project Instructions`, `Graphify Knowledge Graph`, `Zod Input Validation` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._