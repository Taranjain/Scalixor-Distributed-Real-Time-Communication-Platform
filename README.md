# Scalixor

A horizontally-scalable real-time communication platform with **group chat**, **collaborative code editing**, and **1:1 video calling**, built on WebSocket + Redis Pub/Sub with WebRTC peer-to-peer media.

---

## Visual Preview

### Landing Page
```
┌─────────────────────────────────────────────────────────┐
│  [◆ Scalixor]                              Get Started  │
│                                                         │
│              Real-Time Communication                    │
│              for Developers                             │
│                                                         │
│   Chat, code together, and video call — built for       │
│   teams, interviews, pair programming, and teaching.    │
│                                                         │
│   [ Get Started  → ]    [ View on GitHub  ↗ ]           │
│                                                         │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│   │   ◆◆◆      │  │   { }      │  │   ▶▶       │       │
│   │ Real-Time  │  │ Collaborative│  │ 1:1 Video  │       │
│   │ Chat       │  │ Editor       │  │ Calling    │       │
│   └────────────┘  └────────────┘  └────────────┘       │
│   ┌────────────┐                                        │
│   │   ◇◇◇      │  Horizontally Scalable                 │
│   │ Redis Pub/ │  Scale out without limits              │
│   │ Sub + WS   │                                        │
│   └────────────┘                                        │
│                                                         │
│   © Scalixor                                            │
└─────────────────────────────────────────────────────────┘
```

### Auth Screen
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    [◆] Scalixor                         │
│                   Welcome back                          │
│           Sign in to your account to continue           │
│                                                         │
│         [ Login ]────[ Sign Up ]                        │
│         ┌──────────────────────┐                        │
│         │ Username             │                        │
│         │ Password             │                        │
│         │ [     Login      ]   │                        │
│         └──────────────────────┘                        │
│                                                         │
│              Back to home                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Main App — Light Mode
```
┌────────────────┬────────────────────────────────────────┐
│ ◆ Scalixor     │ #general      [Code]  ● Connected      │
│ [↗] Logout     ├────────────────────────────────────────┤
│ ───────────────│                                        │
│ [◆] Rooms      │ Alice: Hey!                            │
│ [◇] Friends    │                                        │
│ [▶] Calls      │ You: Hi there                          │
│ ───────────────│                                        │
│ Online   3     │ [Type your message...    ] [Send]      │
│ ● Alice        ├────────────────────────────────────────┤
│ ● Bob          │ [Code Editor Panel]                    │
│ ● You (you)    │                                        │
└────────────────┴────────────────────────────────────────┘
```

### Main App — Dark Mode
```
┌────────────────┬────────────────────────────────────────┐
│ ◆ Scalixor     │ #general      [Code]  ● Connected      │
│ [↗] Logout     ├────────────────────────────────────────┤
│ ───────────────│                                        │
│ [◆] Rooms      │ Alice: Hey!                            │
│ [◇] Friends    │                                        │
│ [▶] Calls      │ You: Hi there                          │
│ ───────────────│                                        │
│ Online   3     │ [Type your message...    ] [Send]      │
│ ● Alice        ├────────────────────────────────────────┤
│ ● Bob          │ [Code Editor Panel]                    │
│ ● You (you)    │                                        │
└────────────────┴────────────────────────────────────────┘
```
*(Same layout, dark palette: #09090b paper, #18181b surface, #60a5fa accent)*

### Video Call Overlay
```
┌─────────────────────────────────────────────────────────┐
│  [Remote Video - Full Screen]                           │
│                                                         │
│  ┌─────────┐   In call with Bob                        │
│  │ [Local] │                                           │
│  └─────────┘                                            │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │  🎤     │  │  📷     │  │  📵     │                 │
│  │  Mute   │  │ Camera  │  │  End    │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
*(Icons are SVG; labels read "Mute/Unmute", "Camera Off/On", "End")*

---

## Architecture

```
   Clients (Browser)
        │
        │  WebSocket (Chat + Signaling)
        ▼
   ┌─── Caddy (Reverse Proxy / Load Balancer) ───┐
   │            ip_hash sticky sessions           │
   ▼            ▼            ▼
 ws1:4001    ws2:4002    ws3:4003    ← Multiple Backend Instances
   │            │            │
   └────────────┼────────────┘
                │  Redis Pub/Sub
                ▼
        ┌──────────────┐
        │  Redis Server │
        │  • Chat Channel (broadcast)
        │  • Signaling Channel (targeted relay)
        │  • Online Users Set (cross-server tracking)
        └──────────────┘

After WebRTC signaling completes:
  Client A 🎥 ←─── P2P Media (WebRTC) ───→ 🎥 Client B
```

## How It Works

### Chat System
1. Client sends a `message` over WebSocket
2. Server publishes to Redis `chat_channel`
3. All server instances receive the message and broadcast to their local clients
4. Every client sees the message regardless of which server they're connected to

### WebRTC Video Calling
1. **Offer**: Caller creates an SDP offer → sent via WebSocket → published to Redis `signaling_channel` → delivered to the callee's server instance → forwarded to callee
2. **Answer**: Callee accepts → creates SDP answer → same relay back to caller
3. **ICE Candidates**: Exchanged via the same WebSocket/Redis pathway
4. **Media**: Flows **directly P2P** between browsers (never through the server)

### Horizontal Scaling
- Each server instance maintains a local `Map<username, WebSocket>` for connected users
- Redis Set (`online_users`) tracks all online users across every server
- Redis Pub/Sub ensures chat messages reach all servers and signaling reaches the correct server
- Caddy uses `ip_hash` for sticky sessions so a client's WebSocket stays on one server

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Design System | Geist + Geist Mono, CSS Custom Properties, Light/Dark mode |
| Backend | Node.js, TypeScript, Express, `ws` library |
| Database | PostgreSQL (Prisma ORM) |
| Pub/Sub | Redis 7 (ioredis) |
| Video | WebRTC (native browser API) |
| STUN | `stun:stun.l.google.com:19302` |
| Reverse Proxy | Caddy 2 |
| Containers | Docker Compose |

## Project Structure

```
├── client/
│   ├── index.html          # Landing page + Chat UI + Video Call UI
│   ├── tokens.css          # Design system tokens (light/dark)
│   ├── index.css           # Component styles
│   ├── index.js            # WebSocket client + WebRTC logic
│   ├── editor.style.css    # Code editor styles
│   └── editor.bundle.js    # Code editor bundle
├── server/
│   ├── src/
│   │   ├── index.ts         # Entry point, connection handler
│   │   ├── types.ts         # TypeScript types & enums
│   │   ├── redis.ts         # Redis Pub/Sub + online user tracking
│   │   ├── signaling.ts     # WebRTC signaling relay
│   │   ├── utils.ts         # Helpers (parse, broadcast, logging)
│   │   ├── auth.ts          # JWT auth
│   │   ├── prisma.ts        # Prisma client
│   │   └── routes.ts        # REST API routes
│   ├── .env                 # Environment variables
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml       # 3 WS servers + Redis + Caddy + Postgres
├── Caddyfile                # Reverse proxy with sticky sessions
├── README.md
└── PROJECT_DEEP_DIVE.md     # Comprehensive architecture docs
```

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Run

```bash
# Clone and start
git clone <repo-url>
cd Scalixor
docker-compose up --build
```

Open **http://localhost:3000** in your browser.

### Test Multi-User

1. Open `http://localhost:3000` in Browser 1 → Connect as **Alice**
2. Open `http://localhost:3000` in Browser 2 (or incognito) → Connect as **Bob**
3. **Chat**: Send messages between browsers
4. **Video Call**: Click **Call** next to a user → Accept/Reject on the other end
5. **Controls**: Toggle mic, camera, or end call

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | WebSocket server port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret for signing JWT tokens |

These are set per-instance in `docker-compose.yml`. The `.env` file provides defaults for local development.

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `message` | Client ↔ Server | Chat messages |
| `event` | Client ↔ Server | Join/leave notifications |
| `user-list` | Server → Client | Online users update |
| `join-room` | Client → Server | Subscribe to a room |
| `leave-room` | Client → Server | Unsubscribe from a room |
| `offer` | Client → Server → Client | WebRTC SDP offer |
| `answer` | Client → Server → Client | WebRTC SDP answer |
| `ice-candidate` | Client → Server → Client | ICE connectivity candidate |
| `call-rejected` | Client → Server → Client | Call rejection |
| `call-ended` | Client → Server → Client | Call termination |
| `code-update` | Client ↔ Server | Collaborative editor delta |
| `code-language-change` | Client ↔ Server | Editor language switch |
| `code-sync-request` | Client → Server | Request full editor state |
| `code-sync-response` | Server → Client | Full editor state reply |

## Features

- ✅ Professional landing page with light/dark mode
- ✅ Real-time group chat with message history
- ✅ 1:1 video calling (WebRTC P2P)
- ✅ Collaborative code editor (multi-language, real-time sync)
- ✅ Online users list (cross-server)
- ✅ Incoming call modal (Accept / Reject)
- ✅ Mic & Camera toggle with text labels
- ✅ Heartbeat (dead connection cleanup)
- ✅ Auto-reconnect (5 attempts)
- ✅ Horizontally scalable (3 instances demo)
- ✅ Redis Pub/Sub for cross-server sync
- ✅ Sticky sessions via Caddy
- ✅ Light & Dark theme toggle
- ✅ Graceful shutdown
- ✅ Friend requests & DM rooms
- ✅ Call history

## Design System

Scalixor uses a custom token-based design system:

- **Font**: Geist (sans) + Geist Mono (code)
- **Colors**: Slate neutrals with blue accent (`#2563eb` light / `#60a5fa` dark)
- **Spacing**: 4pt scale with semantic names
- **Motion**: CSS transitions only, respects `prefers-reduced-motion`
- **Icons**: Inline SVG sprite, never emojis as UI elements

See `client/tokens.css` for the full token reference.
