# 🚀 Distributed Real-Time Communication Platform

A horizontally-scalable real-time communication platform with **group chat** and **1:1 video calling**, built on WebSocket + Redis Pub/Sub with WebRTC peer-to-peer media.

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
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, TypeScript, `ws` library |
| Pub/Sub | Redis 7 (ioredis) |
| Video | WebRTC (native browser API) |
| STUN | `stun:stun.l.google.com:19302` |
| Reverse Proxy | Caddy 2 |
| Containers | Docker Compose |

## Project Structure

```
├── client/
│   ├── index.html          # Chat UI + Video Call UI
│   ├── index.css            # Dark theme design system
│   └── index.js             # WebSocket client + WebRTC logic
├── server/
│   ├── src/
│   │   ├── index.ts         # Entry point, connection handler
│   │   ├── types.ts         # TypeScript types & enums
│   │   ├── redis.ts         # Redis Pub/Sub + online user tracking
│   │   ├── signaling.ts     # WebRTC signaling relay
│   │   └── utils.ts         # Helpers (parse, broadcast, logging)
│   ├── .env                 # Environment variables
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml       # 3 WS servers + Redis + Caddy
├── Caddyfile                # Reverse proxy with sticky sessions
└── README.md
```

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Run

```bash
# Clone and start
git clone <repo-url>
cd Real_Time_Chat_App-main
docker-compose up --build
```

Open **http://localhost:3000** in your browser.

### Test Multi-User

1. Open `http://localhost:3000` in Browser 1 → Connect as **Alice**
2. Open `http://localhost:3000` in Browser 2 (or incognito) → Connect as **Bob**
3. **Chat**: Send messages between browsers
4. **Video Call**: Click 📹 **Call** next to a user → Accept/Reject on the other end
5. **Controls**: Toggle mic 🎤, camera 📷, or end call 📵

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | WebSocket server port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |

These are set per-instance in `docker-compose.yml`. The `.env` file provides defaults for local development.

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `message` | Client ↔ Server | Chat messages |
| `event` | Client ↔ Server | Join/leave notifications |
| `user-list` | Server → Client | Online users update |
| `offer` | Client → Server → Client | WebRTC SDP offer |
| `answer` | Client → Server → Client | WebRTC SDP answer |
| `ice-candidate` | Client → Server → Client | ICE connectivity candidate |
| `call-rejected` | Client → Server → Client | Call rejection |
| `call-ended` | Client → Server → Client | Call termination |

## Features

- ✅ Real-time group chat
- ✅ 1:1 video calling (WebRTC P2P)
- ✅ Online users list (cross-server)
- ✅ Incoming call modal (Accept / Reject)
- ✅ Mic & Camera toggle
- ✅ Heartbeat (dead connection cleanup)
- ✅ Auto-reconnect (5 attempts)
- ✅ Horizontally scalable (3 instances demo)
- ✅ Redis Pub/Sub for cross-server sync
- ✅ Sticky sessions via Caddy
- ✅ Dark theme UI
- ✅ Graceful shutdown

## License

MIT
