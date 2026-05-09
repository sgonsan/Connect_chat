# Graph Report - .  (2026-05-09)

## Corpus Check
- Corpus is ~24,614 words - fits in a single context window. You may not need a graph.

## Summary
- 376 nodes · 533 edges · 28 communities (21 shown, 7 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Express App Core|Express App Core]]
- [[_COMMUNITY_Auth & Channel Middleware|Auth & Channel Middleware]]
- [[_COMMUNITY_Auth Service Layer|Auth Service Layer]]
- [[_COMMUNITY_Channels Module|Channels Module]]
- [[_COMMUNITY_React Frontend Components|React Frontend Components]]
- [[_COMMUNITY_Auth Repository & Tokens|Auth Repository & Tokens]]
- [[_COMMUNITY_Channel & Server Repos|Channel & Server Repos]]
- [[_COMMUNITY_React Pages & Contexts|React Pages & Contexts]]
- [[_COMMUNITY_Auth Routes & Validation|Auth Routes & Validation]]
- [[_COMMUNITY_Server Membership Guards|Server Membership Guards]]
- [[_COMMUNITY_Backend Module Overview|Backend Module Overview]]
- [[_COMMUNITY_Socket & Config Layer|Socket & Config Layer]]
- [[_COMMUNITY_Integration Test Suite|Integration Test Suite]]
- [[_COMMUNITY_User & Token DB Ops|User & Token DB Ops]]
- [[_COMMUNITY_Servers Routes & Schema|Servers Routes & Schema]]
- [[_COMMUNITY_Environment Config|Environment Config]]
- [[_COMMUNITY_Client Build Tools|Client Build Tools]]
- [[_COMMUNITY_Project Config & Graphify|Project Config & Graphify]]
- [[_COMMUNITY_Error & Validation Middleware|Error & Validation Middleware]]
- [[_COMMUNITY_Test Jest Config|Test Jest Config]]
- [[_COMMUNITY_Auth Middleware Tests|Auth Middleware Tests]]
- [[_COMMUNITY_Rate Limiter|Rate Limiter]]
- [[_COMMUNITY_MessageInput Component|MessageInput Component]]
- [[_COMMUNITY_HTML Entry Point|HTML Entry Point]]

## God Nodes (most connected - your core abstractions)
1. `createError()` - 22 edges
2. `next` - 18 edges
3. `useAuth()` - 16 edges
4. `AuthContext.jsx — Authentication React context provider` - 8 edges
5. `_issueTokens()` - 7 edges
6. `servers.routes` - 7 edges
7. `Initial DB Schema Migration` - 7 edges
8. `App.jsx — Root router with auth guards` - 7 edges
9. `Phase 2 WebRTC Design Spec — LiveKit voice/video design` - 6 edges
10. `signAccessToken()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `socket.js — Socket.IO client singleton` --implements--> `Socket.IO Gateway — real-time WebSocket event bus`  [INFERRED]
  client/src/socket.js → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `SocketContext.jsx — Socket.IO React context provider` --implements--> `Socket.IO Gateway — real-time WebSocket event bus`  [INFERRED]
  client/src/context/SocketContext.jsx → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `AuthContext.jsx — Authentication React context provider` --implements--> `JWT Authentication — access token plus HttpOnly refresh cookie`  [EXTRACTED]
  client/src/context/AuthContext.jsx → docs/superpowers/specs/2026-05-09-discord-clone-design.md
- `AppPage.jsx — Main authenticated application page` --conceptually_related_to--> `VoiceArea component — LiveKitRoom grid replacing ChatArea`  [INFERRED]
  client/src/pages/AppPage.jsx → docs/superpowers/plans/2026-05-09-connect-chat-phase2-plan.md
- `ChatArea.jsx — Real-time channel message display` --shares_data_with--> `PostgreSQL Data Model — users, servers, channels, messages, refresh_tokens`  [INFERRED]
  client/src/components/ChatArea.jsx → docs/superpowers/specs/2026-05-09-discord-clone-design.md

## Hyperedges (group relationships)
- **Messages MVC Layer** — messages_schema, messages_repository, messages_controller, messages_service, messages_routes [INFERRED 0.95]
- **Users MVC Layer** — users_schema, users_repository, users_controller, users_service, users_routes [INFERRED 0.95]
- **Auth MVC Layer** — auth_schema, auth_repository, auth_controller, auth_service, auth_routes [INFERRED 0.95]
- **Channels MVC Layer** — channels_schema, channels_repository, channels_controller, channels_service, channels_routes [INFERRED 0.95]
- **Servers MVC Layer** — servers_schema, servers_repository, servers_controller, servers_service, servers_routes [INFERRED 0.95]
- **Integration Test Suite** — messages_integration_test, users_integration_test, auth_integration_test, channels_integration_test, servers_integration_test [INFERRED 0.95]
- **Auth Test Suite** — auth_service_test, auth_integration_test, authenticate_test [INFERRED 0.85]
- **Socket Authentication Flow** — socket_gateway, config_jwt, middleware_authenticate [INFERRED 0.85]
- **Core DB Schema Entities** — db_table_users, db_table_servers, db_table_server_members, db_table_channels, db_table_messages, db_table_refresh_tokens [EXTRACTED 1.00]
- **Express Server Middleware Stack** — middleware_authenticate, middleware_isowner, middleware_ismember, middleware_validate, middleware_ratelimiter, middleware_errorhandler [INFERRED 0.85]
- **Client Build Configuration** — client_vite, client_tailwind, client_postcss [INFERRED 0.85]
- **Client authentication flow: AuthContext + Login/Register + JWT** — client_authcontext_jsx, client_login_jsx, client_register_jsx, concept_jwt_auth [EXTRACTED 0.95]
- **Real-time messaging stack: socket.js + SocketContext + ChatArea + Socket.IO Gateway** — client_socket_js, client_socketcontext_jsx, client_chatarea_jsx, concept_socketio_gateway [INFERRED 0.90]
- **Main app layout: AppPage + ServerList + ChannelList + ChatArea** — client_apppage_jsx, client_serverlist_jsx, client_channellist_jsx, client_chatarea_jsx [EXTRACTED 0.95]
- **Phase 2 voice architecture: LiveKit SFU + VoiceArea + voice token endpoint + channel type** — concept_livekit_sfu, concept_voicearea, concept_voice_token_endpoint, concept_channel_type, spec_phase2_webrtc, plan_phase2 [EXTRACTED 0.95]
- **Design specs and implementation plans cross-reference** — spec_discord_clone, spec_phase2_webrtc, plan_phase1, plan_phase2 [INFERRED 0.85]

## Communities (28 total, 7 thin omitted)

### Community 0 - "Express App Core"
Cohesion: 0.06
Nodes (21): app, pool, request, app, pool, request, env, { Pool } (+13 more)

### Community 1 - "Auth & Channel Middleware"
Cohesion: 0.07
Nodes (30): authenticate, channelsRouter, { createChannelSchema }, ctrl, { Router }, serversRouter, validate, createChannelSchema (+22 more)

### Community 2 - "Auth Service Layer"
Cohesion: 0.08
Nodes (28): authService, COOKIE_OPTS, { createError }, env, login(), logout(), refresh(), register() (+20 more)

### Community 3 - "Channels Module"
Cohesion: 0.1
Nodes (23): channelsRepo, createChannel(), { createError }, deleteChannel(), serversRepo, { createError }, createMessage(), deleteMessage() (+15 more)

### Community 4 - "React Frontend Components"
Cohesion: 0.13
Nodes (16): ChannelList(), ChatArea(), ServerList(), AuthContext, AuthProvider(), useAuth(), SocketContext, SocketProvider() (+8 more)

### Community 5 - "Auth Repository & Tokens"
Cohesion: 0.11
Nodes (24): authRepo, bcrypt, { createError }, _issueTokens(), login(), logout(), refresh(), register() (+16 more)

### Community 6 - "Channel & Server Repos"
Cohesion: 0.09
Nodes (16): pool, channelsRepo, registerChannelHandlers(), serversRepo, messagesService, registerMessageHandlers(), { registerChannelHandlers }, { registerMessageHandlers } (+8 more)

### Community 7 - "React Pages & Contexts"
Cohesion: 0.15
Nodes (24): App.jsx — Root router with auth guards, AppPage.jsx — Main authenticated application page, AuthContext.jsx — Authentication React context provider, ChannelList.jsx — Channel sidebar with create, ChatArea.jsx — Real-time channel message display, Login.jsx — User login page, main.jsx — React app entry point, Register.jsx — User registration page (+16 more)

### Community 8 - "Auth Routes & Validation"
Cohesion: 0.12
Nodes (14): ctrl, { registerSchema, loginSchema }, { Router }, validate, loginSchema, registerSchema, { z }, authenticate (+6 more)

### Community 9 - "Server Membership Guards"
Cohesion: 0.12
Nodes (3): serversRepo, serversRepo, pool

### Community 10 - "Backend Module Overview"
Cohesion: 0.13
Nodes (17): app.js — Express application factory, auth.controller, auth.repository, auth.routes, auth.schema, auth.service, messages.controller, messages.repository (+9 more)

### Community 11 - "Socket & Config Layer"
Cohesion: 0.21
Nodes (17): Channel Socket Handler, Environment Config, JWT Config, Database Migration Runner, Database Pool, Initial DB Schema Migration, channels table, messages table (+9 more)

### Community 12 - "Integration Test Suite"
Cohesion: 0.17
Nodes (16): auth.integration.test, auth.service.test, channels.controller, channels.integration.test, channels.repository, channels.routes, channels.schema, channels.service (+8 more)

### Community 13 - "User & Token DB Ops"
Cohesion: 0.17
Nodes (4): pool, authRepo, authService, bcrypt

### Community 14 - "Servers Routes & Schema"
Cohesion: 0.24
Nodes (8): authenticate, { createServerSchema, joinServerSchema }, ctrl, { Router }, validate, createServerSchema, joinServerSchema, { z }

### Community 15 - "Environment Config"
Cohesion: 0.22
Nodes (5): path, env, fs, path, { Pool }

### Community 16 - "Client Build Tools"
Cohesion: 0.67
Nodes (3): PostCSS Config, Tailwind Config, Vite Config

## Knowledge Gaps
- **146 isolated node(s):** `express`, `cookieParser`, `cors`, `helmet`, `{ errorHandler }` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `Auth & Channel Middleware` to `React Frontend Components`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `createError()` connect `Channels Module` to `Auth Service Layer`, `Auth Repository & Tokens`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `next` connect `Auth Service Layer` to `Auth Repository & Tokens`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `next` (e.g. with `getMessages()` and `deleteMessage()`) actually correct?**
  _`next` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `express`, `cookieParser`, `cors` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Express App Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Auth & Channel Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._