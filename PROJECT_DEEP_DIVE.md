# Scalixor — Project Deep Dive

> **Comprehensive technical documentation** for the Scalixor distributed real-time communication platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend Deep Dive](#3-frontend-deep-dive)
4. [Backend Deep Dive](#4-backend-deep-dive)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [WebSocket Protocol](#8-websocket-protocol)
9. [WebRTC Signaling](#9-webrtc-signaling)
10. [Deployment & DevOps](#10-deployment--devops)
11. [Security Considerations](#11-security-considerations)
12. [Performance Optimizations](#12-performance-optimizations)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. Project Overview

**Scalixor** is a horizontally-scalable real-time communication platform designed for developer workflows. It combines group chat, collaborative code editing, and 1:1 video calling in a single unified interface.

### Core Philosophy

- **Scale-first**: Every design decision assumes multiple server instances
- **Privacy-first**: Video media never touches the server (pure WebRTC P2P)
- **Developer-centric**: Clean UI, collaborative code editor, interview-ready
- **Zero-config deployment**: Single `docker-compose up` to run the entire stack

### Target Use Cases

| Use Case | Features Used |
|----------|---------------|
| Remote team standups | Group rooms + chat |
| Technical interviews | Video call + collaborative editor |
| Pair programming | DM room + code editor + screen share (future) |
| DSA teaching | Group room + code editor + video |
| Casual friend chat | Friends list + DM rooms + video calls |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Browser    │  │   Browser    │  │   Browser    │  │   Browser   │ │
│  │  (Alice)     │  │   (Bob)      │  │  (Charlie)   │  │   (Dave)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │ WebSocket        │ WebSocket        │ WebSocket        │        │
│         └─────────────────┬┴─────────────────┬┴─────────────────┘        │
│                           │                  │                           │
└───────────────────────────┼──────────────────┼───────────────────────────┘
                            │                  │
┌───────────────────────────┼──────────────────┼───────────────────────────┐
│                           ▼                  ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         CADDY REVERSE PROXY                         │ │
│  │                     ip_hash sticky sessions                         │ │
│  │                                                                     │ │
│  │   Alice ──→ ws1:4001    Bob ──→ ws2:4002    Charlie ──→ ws3:4003  │ │
│  │   (always)              (always)              (always)              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                           │                  │                           │
│         ┌─────────────────┘                  └─────────────────┐         │
│         ▼                                                      ▼         │
│  ┌─────────────┐                                        ┌─────────────┐ │
│  │  ws1:4001   │◄─────── Redis Pub/Sub ────────────────►│  ws2:4002   │ │
│  │  Node.js    │         (chat_channel)                  │  Node.js    │ │
│  │  Express    │         (signaling_channel)             │  Express    │ │
│  │  WebSocket  │         (room:<uuid>)                   │  WebSocket  │ │
│  └──────┬──────┘                                        └──────┬──────┘ │
│         │                                                       │        │
│         └─────────────────────┬─────────────────────────────────┘        │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         REDIS SERVER                                │ │
│  │  • chat_channel      ── Broadcast chat to all instances             │ │
│  │  • signaling_channel ── Targeted WebRTC signaling relay             │ │
│  │  • room:<uuid>       ── Room-scoped message delivery                │ │
│  │  • online_users      ── Redis Set of all connected users            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      POSTGRESQL DATABASE                            │ │
│  │  • Users, Rooms, Messages, Friendships, CallLogs                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Problem | Solution |
|---------|----------|
| Single server bottleneck | Multiple WebSocket instances behind load balancer |
| Messages lost across instances | Redis Pub/Sub broadcasts to all instances |
| WebRTC signaling routing | Redis `signaling_channel` + targeted username lookup |
| Online user accuracy | Redis Set (`online_users`) shared across all instances |
| Sticky WebSocket connections | Caddy `ip_hash` routes same IP to same backend |
| Room-scoped messages | Per-room Redis channels (`room:<uuid>`) |

---

## 3. Frontend Deep Dive

### 3.1 Design System (`tokens.css`)

Scalixor uses a **token-based CSS architecture** with first-class light/dark mode support.

#### Token Categories

```css
/* Typography */
--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', monospace;

/* Colors (light mode example) */
--color-paper:   #fafafa;   /* Page background */
--color-surface: #ffffff;   /* Card background */
--color-elevated:#f4f4f5;   /* Slightly raised surface */
--color-ink:     #18181b;   /* Primary text */
--color-muted:   #71717a;   /* Secondary text */
--color-border:  #e4e4e7;   /* Dividers */
--color-accent:  #2563eb;   /* Primary action */

/* Spacing (4px base) */
--space-1: 0.25rem;  /* 4px */
--space-4: 1rem;     /* 16px */
--space-8: 2rem;     /* 32px */

/* Motion */
--dur-fast:   150ms;
--dur-normal: 200ms;
--ease-out:   cubic-bezier(0, 0, 0.2, 1);
```

#### Theme Toggle Mechanism

```javascript
// ThemeManager class
class ThemeManager {
    set(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("scalixor-theme", theme);
    }
    toggle() {
        const current = document.documentElement.getAttribute("data-theme");
        this.set(current === "light" ? "dark" : "light");
    }
}
```

All color transitions are smoothed via CSS:
```css
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: var(--dur-normal);
}
```

### 3.2 Application State Machine

The frontend has three primary views managed as a state machine:

```
┌─────────────┐     Get Started     ┌─────────────┐     Login/Signup     ┌─────────────┐
│   Landing   │ ──────────────────► │    Auth     │ ──────────────────► │     App     │
│    Page     │                     │   Screen    │                     │  (Chat)     │
└─────────────┘ ◄────────────────── └─────────────┘ ◄────────────────── └─────────────┘
     ↑                Back to home         ↑               Logout                │
     │                                                                          │
     └──────────────────────────────────────────────────────────────────────────┘
```

**Key DOM states:**
- `#landing-page` → `display: block/none`
- `#auth-screen` → `.active` class toggles `display: flex/none`
- `#app` → `.active` class toggles `display: flex/none`

### 3.3 Component Hierarchy

```
ChatClient (main controller)
├── ThemeManager
├── Landing Page
│   ├── Nav
│   ├── Hero
│   ├── Features Grid
│   └── Footer
├── Auth Screen
│   ├── Logo
│   ├── Tabs (Login/Signup)
│   └── Forms
└── Main App
    ├── Sidebar
    │   ├── User Header
    │   ├── Tabs (Rooms/Friends/Calls)
    │   ├── Content Panels
    │   └── Online Users
    ├── Chat Area
    │   ├── Header (Room Title, Actions)
    │   ├── Welcome Screen
    │   ├── Message List
    │   └── Input Area
    └── Code Editor Panel (overlay)
        ├── Toolbar (Language Select)
        └── Editor Container
```

### 3.4 WebSocket Client Architecture

```javascript
class ChatClient {
    // Connection state
    socket = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    manualDisconnect = false;

    // Reconnection strategy: exponential backoff capped at 2s
    socket.onclose = () => {
        if (!manualDisconnect && reconnectAttempts < 5) {
            reconnectAttempts++;
            setTimeout(() => connectWebSocket(), 2000);
        }
    };
}
```

**Connection lifecycle:**
1. `DOMContentLoaded` → `new ChatClient()`
2. If token exists → `showApp()` + `connectWebSocket()`
3. `socket.onopen` → Send `event:joined` with JWT token
4. `socket.onmessage` → Route to `handleMessage()`
5. `socket.onclose` → Auto-reconnect (unless manual disconnect)

### 3.5 WebRTC Implementation

```
Caller                              Callee
  │                                   │
  ├─ getUserMedia() ─────────────────►│
  ├─ createOffer()                    │
  ├─ setLocalDescription(offer)       │
  ├─ send "offer" via WS/Redis ──────►│
  │                                   ├─ getUserMedia()
  │                                   ├─ setRemoteDescription(offer)
  │                                   ├─ createAnswer()
  │                                   ├─ setLocalDescription(answer)
  │◄────────────────────────send "answer" via WS/Redis
  ├─ setRemoteDescription(answer)     │
  │                                   │
  ├─ ICE candidates ────────────────►├─ ICE candidates
  │◄────────────────────────────ICE candidates
  │                                   │
  ▼                                   ▼
[Direct P2P connection established]
```

**ICE candidate queuing:**
- Candidates may arrive before `setRemoteDescription()` is called
- `pendingIceCandidates[]` queues them until the remote description is set
- Then all queued candidates are flushed via `addIceCandidate()`

### 3.6 Code Editor Integration

The code editor uses a **Yjs-based CRDT** (Conflict-free Replicated Data Type) for real-time collaboration:

| Feature | Implementation |
|---------|---------------|
| Real-time sync | Yjs document shared over WebSocket |
| Late-joiner sync | `code-sync-request` → `code-sync-response` |
| Language switching | Broadcast `code-language-change` to all peers |
| Autosave | 5-second interval to PostgreSQL |
| Persistence | `/api/rooms/:id/code` REST endpoint |

---

## 4. Backend Deep Dive

### 4.1 Server Entry Point (`server/src/index.ts`)

```typescript
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
```

**Why HTTP + WebSocket on same port?**
- Simplifies Caddy routing (single upstream)
- Enables WebSocket upgrade on existing HTTP connection
- Health checks and REST API on same port

### 4.2 User Registry (`userMap`)

```typescript
const userMap: Map<string, UserEntry> = new Map();

interface UserEntry {
    ws: WebSocket;
    userId: string;
    rooms: Set<string>;  // Subscribed room channels
}
```

Each server instance maintains its **local** user registry. Cross-instance awareness comes from Redis.

### 4.3 Redis Architecture

```typescript
// Publisher: for sending messages
const publisher = new Redis(REDIS_URL);

// Subscriber: for receiving messages (separate connection)
const subscriber = publisher.duplicate();
```

**Channels:**

| Channel | Pattern | Purpose |
|---------|---------|---------|
| `chat_channel` | Broadcast | Global events (join/leave/online list) |
| `signaling_channel` | Broadcast | WebRTC signaling (filtered by username) |
| `room:${uuid}` | Room-scoped | Chat messages within a specific room |

**Why separate publisher/subscriber?**
- Redis Pub/Sub requires separate connections for pub and sub
- `publisher.duplicate()` shares the connection pool but creates a new client

### 4.4 Message Router

```typescript
// Chat messages → room-scoped channel
await publishToRoom(roomId, payload);

// Signaling → broadcast channel (filtered by username)
await publishSignaling(payload);

// Events → broadcast channel
await publishChat(payload);
```

### 4.5 Authentication Flow

```
Client                          Server
  │                              │
  ├─ POST /api/auth/signup ────►├─ bcrypt.hash(password, 10)
  │                              ├─ prisma.user.create()
  │◄─────────────────────────────┤─ jwt.sign({ userId, username })
  │     { token, user }          │
  │                              │
  ├─ WebSocket connect ─────────►├─ On "event:joined"
  │   send token in payload      ├─ jwt.verify(token)
  │                              ├─ Register in userMap
  │                              ├─ sadd online_users <username>
  │                              ├─ publish user-list update
```

### 4.6 Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String
  rooms     RoomMember[]
  messages  Message[]
  sentRequests     Friendship[] @relation("SentRequests")
  receivedRequests Friendship[] @relation("ReceivedRequests")
  callsAsCaller    CallLog[]    @relation("Caller")
  callsAsCallee    CallLog[]    @relation("Callee")
  createdAt DateTime @default(now())
}

model Room {
  id        String   @id @default(uuid())
  name      String?
  isGroup   Boolean  @default(true)
  members   RoomMember[]
  messages  Message[]
  codeSession CodeSession?
  createdAt DateTime @default(now())
}

model Message {
  id        String   @id @default(uuid())
  content   String
  senderId  String
  sender    User     @relation(fields: [senderId], references: [id])
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  createdAt DateTime @default(now())
}

model Friendship {
  id        String   @id @default(uuid())
  userId    String
  friendId  String
  user      User     @relation("SentRequests", fields: [userId], references: [id])
  friend    User     @relation("ReceivedRequests", fields: [friendId], references: [id])
  status    String   // PENDING | ACCEPTED
  createdAt DateTime @default(now())
}

model CallLog {
  id        String   @id @default(uuid())
  callerId  String
  calleeId  String
  caller    User     @relation("Caller", fields: [callerId], references: [id])
  callee    User     @relation("Callee", fields: [calleeId], references: [id])
  status    String   // completed | rejected | missed
  duration  Int?     // seconds
  startedAt DateTime @default(now())
  endedAt   DateTime?
}

model CodeSession {
  id        String   @id @default(uuid())
  roomId    String   @unique
  room      Room     @relation(fields: [roomId], references: [id])
  content   String   @default("")
  language  String   @default("javascript")
  updatedAt DateTime @updatedAt
}
```

---

## 5. Data Flow Diagrams

### 5.1 Chat Message Flow (Cross-Server)

```
Alice (ws1) ──message──► ws1 ──publish room:abc ──► Redis
                                                      │
                              ┌──────────────────────┼──────────────────────┐
                              ▼                      ▼                      ▼
                            ws1                    ws2                    ws3
                              │                      │                      │
                           Alice                   Bob                   Charlie
                           (local)               (local)                 (local)
```

1. Alice sends `message` to ws1
2. ws1 saves to PostgreSQL
3. ws1 `PUBLISH room:abc <payload>` to Redis
4. Redis delivers to ws1, ws2, ws3
5. Each server broadcasts to local clients in that room

### 5.2 WebRTC Signaling Flow

```
Alice (ws1) ──offer──► ws1 ──publish signaling ──► Redis
                                                     │
                              ┌─────────────────────┘
                              ▼
                            ws3 (Bob's server)
                              │
                           Bob (local lookup)
                           
Bob (ws3) ──answer──► ws3 ──publish signaling ──► Redis
                                                    │
                             ┌────────────────────┘
                             ▼
                           ws1 (Alice's server)
                             │
                          Alice (local lookup)
```

**Key insight:** Redis doesn't know which server has which user. It broadcasts to all servers. Each server checks its local `userMap` and forwards only if the target user is connected locally.

### 5.3 Code Editor Sync Flow

```
Alice types ──code-update──► ws1 ──publish room:abc ──► Redis
                                                          │
                                ┌────────────────────────┘
                                ▼
                              ws2 (Bob's server)
                                │
                             Bob ──applyUpdate()
```

**Late-joiner sync:**
1. Bob joins room → editor initializes with last saved state from DB
2. Bob sends `code-sync-request` to room
3. Alice (or any peer) replies with `code-sync-response` containing full Yjs state
4. Bob applies the full state → now in sync

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌──────────┐       ┌─────────────┐       ┌──────────┐
│   User   │◄─────►│ RoomMember  │◄─────►│   Room   │
│          │  1:M  │             │  M:1  │          │
│ id (PK)  │       │ id (PK)     │       │ id (PK)  │
│ username │       │ userId (FK) │       │ name     │
│ email    │       │ roomId (FK) │       │ isGroup  │
│ password │       └─────────────┘       └────┬─────┘
└────┬─────┘                                  │
     │                                        │
     │ M:1                                    │ 1:1
     ▼                                        ▼
┌──────────┐                          ┌─────────────┐
│ Message  │                          │ CodeSession │
│          │                          │             │
│ id (PK)  │                          │ id (PK)     │
│ content  │                          │ roomId (FK) │
│ senderId │                          │ content     │
│ roomId   │                          │ language    │
└──────────┘                          └─────────────┘

┌────────────┐       ┌──────────┐       ┌──────────┐
│ Friendship │◄─────►│   User   │◄─────►│ CallLog  │
│            │  M:1  │          │  1:M  │          │
│ id (PK)    │       │ id (PK)  │       │ id (PK)  │
│ userId     │       │ username │       │ callerId │
│ friendId   │       │ email    │       │ calleeId │
│ status     │       │ password │       │ status   │
└────────────┘       └──────────┘       │ duration │
                                        └──────────┘
```

---

## 7. API Reference

### Authentication

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/signup` | `{ username, email, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user }` |

### Rooms

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| GET | `/api/rooms` | Bearer | — | `Room[]` |
| POST | `/api/rooms` | Bearer | `{ name }` | `Room` |
| POST | `/api/rooms/join` | Bearer | `{ roomId }` | `Room` |
| GET | `/api/rooms/:id/messages` | Bearer | — | `{ messages: Message[] }` |
| GET | `/api/rooms/:id/code` | Bearer | — | `CodeSession` |
| POST | `/api/rooms/:id/code` | Bearer | `{ content, language }` | `CodeSession` |

### Direct Messages

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| POST | `/api/dm` | Bearer | `{ targetUsername }` | `Room` |

### Friends

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| GET | `/api/friends` | Bearer | — | `Friendship[]` |
| POST | `/api/friends/request` | Bearer | `{ targetUsername }` | `Friendship` |
| PUT | `/api/friends/:id/accept` | Bearer | — | `Friendship` |
| DELETE | `/api/friends/:id` | Bearer | — | — |

### Call History

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| GET | `/api/calls` | Bearer | `CallLog[]` |

### Health

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/health` | `{ status: "ok", port }` |

---

## 8. WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket("ws://localhost:3000/ws");

// Authenticate immediately after open
ws.onopen = () => {
    ws.send(JSON.stringify({
        type: "event",
        action: "joined",
        user: username,
        token: jwtToken,
    }));
};
```

### Message Types

```typescript
enum MessageType {
    Message = "message",
    Event = "event",
    Offer = "offer",
    Answer = "answer",
    IceCandidate = "ice-candidate",
    UserList = "user-list",
    CallRejected = "call-rejected",
    CallEnded = "call-ended",
    JoinRoom = "join-room",
    LeaveRoom = "leave-room",
    CodeUpdate = "code-update",
    CodeLanguageChange = "code-language-change",
    CodeSyncRequest = "code-sync-request",
    CodeSyncResponse = "code-sync-response",
}
```

### Payload Examples

**Chat message:**
```json
{
  "type": "message",
  "user": "alice",
  "content": "Hello!",
  "roomId": "abc-123",
  "timestamp": 1715424000000,
  "server": 4001
}
```

**Join room:**
```json
{
  "type": "join-room",
  "roomId": "abc-123",
  "user": "alice"
}
```

**WebRTC offer:**
```json
{
  "type": "offer",
  "from": "alice",
  "to": "bob",
  "sdp": { ... }
}
```

---

## 9. WebRTC Signaling

### Signaling Message Router

```typescript
function isSignalingMessage(type: string): boolean {
    return ["offer", "answer", "ice-candidate", "call-rejected", "call-ended"].includes(type);
}
```

### Targeted Delivery

```typescript
async function handleSignalingMessage(data, userMap) {
    const target = data.to;
    const entry = userMap.get(target);
    
    if (entry) {
        // Target is on THIS server → deliver directly
        entry.ws.send(JSON.stringify(data));
    } else {
        // Target is on ANOTHER server → publish to Redis
        await publishSignaling(data);
    }
}
```

### STUN Servers

```javascript
{
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ]
}
```

**Note:** For production behind strict NATs, add a TURN server (e.g., Coturn).

---

## 10. Deployment & DevOps

### Docker Compose Stack

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: scalixor
      POSTGRES_PASSWORD: scalixor
      POSTGRES_DB: scalixor

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  ws1:
    build: ./server
    environment:
      PORT: 4001
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://scalixor:scalixor@postgres:5432/scalixor
    depends_on: [postgres, redis]

  ws2:
    build: ./server
    environment:
      PORT: 4002
      # Same REDIS_URL and DATABASE_URL

  ws3:
    build: ./server
    environment:
      PORT: 4003
      # Same REDIS_URL and DATABASE_URL

  caddy:
    image: caddy:2-alpine
    ports:
      - "3000:3000"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
```

### Caddy Configuration

```
:3000 {
    reverse_proxy /ws ws1:4001 ws2:4002 ws3:4003 {
        lb_policy ip_hash  # Sticky sessions
    }

    reverse_proxy /api/* ws1:4001 ws2:4002 ws3:4003 {
        lb_policy round_robin
    }

    file_server {
        root /usr/share/caddy
    }
}
```

**Why `ip_hash` for WebSocket?**
- WebSocket connections are long-lived
- `ip_hash` routes the same client IP to the same backend
- Ensures a user's socket stays on one server instance
- REST API can use round-robin (stateless)

### Scaling Out

To add a 4th server instance:

1. Add to `docker-compose.yml`:
```yaml
ws4:
  build: ./server
  environment:
    PORT: 4004
```

2. Update `Caddyfile`:
```
reverse_proxy /ws ws1:4001 ws2:4002 ws3:4003 ws4:4004 {
    lb_policy ip_hash
}
```

3. `docker-compose up --scale ws4=1`

No code changes needed. Redis handles all cross-instance communication.

---

## 11. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| JWT token theft | Tokens stored in `localStorage` (XSS risk). Future: HttpOnly cookies |
| WebSocket auth bypass | Server verifies JWT on every `event:joined` message |
| SQL injection | Prisma ORM parameterizes all queries |
| Cross-origin WS | Caddy handles CORS; server validates origin |
| DDoS on WS | Heartbeat (30s) terminates dead connections |
| Message injection | Server validates `sender === username` from token |
| Room access control | Server checks `entry.rooms.has(roomId)` before relay |
| Video privacy | Media flows P2P only — server never sees video frames |

### Authentication Flow (Secure)

```
Client ──JWT──► Server
                ├─ verifyToken(jwt)
                ├─ Check payload.username === data.user
                └─ If mismatch → close connection
```

---

## 12. Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Message batching | Room-scoped Redis channels reduce broadcast scope |
| Connection pooling | Prisma connection pool shared across requests |
| Redis pipelining | ioredis auto-pipelines commands |
| Lazy room subscription | Server subscribes to `room:<id>` only when first user joins |
| ICE candidate queuing | Prevents dropped candidates during SDP negotiation |
| Code editor debouncing | Autosave every 5s, not on every keystroke |
| DOM element caching | `cacheDOMElements()` avoids repeated `getElementById` |
| SVG sprite | Single inline SVG definition, `<use>` references |
| CSS transitions only | No layout-triggering animations |

### Benchmarks (Expected)

| Metric | Target |
|--------|--------|
| WS connection setup | < 100ms |
| Message latency (same room) | < 50ms |
| Cross-server message latency | < 100ms |
| WebRTC connection setup | < 3s |
| Concurrent users per instance | 10,000+ |
| Horizontal scale limit | Unbounded (add Redis + instances) |

---

## 13. Troubleshooting Guide

### "Connection error. Is the server running?"

```bash
# Check if containers are running
docker-compose ps

# Check server logs
docker-compose logs ws1

# Check Redis connectivity
docker-compose exec ws1 npx redis-cli -h redis ping
```

### "Could not access camera/microphone"

- Ensure HTTPS or `localhost` (browsers block camera on HTTP non-localhost)
- Check browser permissions
- Try a different browser

### Messages not appearing

1. Check browser console for WS errors
2. Verify both users joined the same room
3. Check Redis: `docker-compose exec redis redis-cli PUBLISH chat_channel test`

### Video call not connecting

1. Both users must be online
2. Check STUN server connectivity
3. If behind symmetric NAT, deploy a TURN server
4. Check browser console for ICE candidate errors

### Theme not persisting

- `localStorage` may be disabled in private/incognito mode
- Check browser DevTools → Application → Local Storage

---

## 14. Future Roadmap

### Short Term (v2.1)
- [ ] Screen sharing
- [ ] File attachments in chat
- [ ] Push notifications
- [ ] Message reactions
- [ ] Typing indicators

### Medium Term (v3.0)
- [ ] Group video calls (WebRTC mesh or SFU)
- [ ] OAuth 2.0 / SSO login
- [ ] Mobile app (React Native / Capacitor)
- [ ] Message search
- [ ] Admin dashboard

### Long Term (v4.0)
- [ ] End-to-end encryption for messages
- [ ] AI-powered code suggestions in editor
- [ ] Plugin system for code editor
- [ ] Whiteboard collaboration
- [ ] Self-hosted marketplace

---

*Scalixor — Built for developers, by developers.*
