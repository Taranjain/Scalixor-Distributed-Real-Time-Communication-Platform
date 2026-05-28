import { randomUUID } from "crypto";
import http from "http";
import express from "express";
import cors from "cors";
import WebSocket, { WebSocketServer, RawData } from "ws";
import dotenv from "dotenv";

dotenv.config();

import { MessageType, ChatPayload, UserMap, UserEntry } from "./types";
import {
  publisher,
  subscriber,
  subscribeToChannels,
  subscribeToRoom,
  publishChat,
  publishToRoom,
  roomChannel,
  CHAT_CHANNEL,
  SIGNALING_CHANNEL,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
  shutdownRedis,
} from "./redis";
import {
  isSignalingMessage,
  handleSignalingMessage,
  handleSignalingFromRedis,
} from "./signaling";
import {
  safeParse,
  broadcastToAll,
  broadcastToRoom,
  log,
  findUsernameByWs,
  findEntryByWs,
} from "./utils";
import { verifyToken } from "./auth";
import prisma from "./prisma";
import routes from "./routes";

/* ================================
   CONFIG
================================ */

const PORT = Number(process.env.PORT) || 5000;

/* ================================
   EXPRESS APP
================================ */

const app = express();
app.use(cors());
app.use(express.json());
app.use(routes);

/* health check */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", port: PORT });
});

/* ================================
   HTTP + WEBSOCKET SERVER
================================ */

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

server.listen(PORT, "0.0.0.0", () => {
  log(PORT, `🚀 HTTP + WebSocket server running on port ${PORT}`);
});

/* ================================
   USER REGISTRY
================================ */

const userMap: UserMap = new Map();

/* Track which room channels this server instance is subscribed to */
const subscribedRooms = new Set<string>();

/* ================================
   BROADCAST ONLINE USERS
================================ */

async function broadcastUserList(): Promise<void> {
  try {
    const users = await getOnlineUsers();
    const payload = JSON.stringify({
      type: MessageType.UserList,
      users: users.sort(),
    });
    broadcastToAll(wss, payload);
  } catch (err) {
    log(PORT, `❌ Failed to broadcast user list: ${err}`);
  }
}

async function publishUserListUpdate(): Promise<void> {
  try {
    const users = await getOnlineUsers();
    const payload = JSON.stringify({
      type: MessageType.UserList,
      users: users.sort(),
    });
    await publisher.publish(CHAT_CHANNEL, payload);
  } catch (err) {
    log(PORT, `❌ Failed to publish user list update: ${err}`);
  }
}

/* ================================
   REDIS LISTENER
================================ */

subscriber.on("message", (channel: string, message: string) => {
  if (channel === CHAT_CHANNEL) {
    broadcastToAll(wss, message);
  } else if (channel === SIGNALING_CHANNEL) {
    handleSignalingFromRedis(message, userMap);
  } else if (channel.startsWith("room:")) {
    // Room-scoped message — deliver to local users in that room
    const roomId = channel.replace("room:", "");
    broadcastToRoom(userMap, roomId, message);
  }
});

subscribeToChannels();

/* ================================
   ENSURE ROOM SUBSCRIPTION
================================ */

async function ensureRoomSubscription(roomId: string): Promise<void> {
  if (!subscribedRooms.has(roomId)) {
    await subscribeToRoom(roomId);
    subscribedRooms.add(roomId);
  }
}

/* ================================
   CONNECTION HANDLER
================================ */

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  log(PORT, `🟢 Client connected (${wss.clients.size} active connections)`);

  // Heartbeat
  (ws as any).isAlive = true;

  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  // Message Handler
  ws.on("message", async (message: RawData) => {
    const parsed = safeParse(message);
    if (!parsed) {
      log(PORT, "⚠️ Invalid JSON received");
      return;
    }

    const { type } = parsed;

    // ---- Chat Message (room-scoped) ----
    if (type === MessageType.Message) {
      const { user, content, roomId } = parsed;
      if (!user || !content || !roomId) return;

      const entry = userMap.get(user);
      if (!entry) return;

      // Save message to database
      try {
        const dbMessage = await prisma.message.create({
          data: {
            content,
            senderId: entry.userId,
            roomId,
          },
        });

        const payload: ChatPayload = {
          id: dbMessage.id,
          type: MessageType.Message,
          user,
          content,
          roomId,
          timestamp: dbMessage.createdAt.getTime(),
          server: PORT,
        };

        log(PORT, `💬 [${roomId}] ${user}: ${content}`);
        await publishToRoom(roomId, payload);
      } catch (err) {
        log(PORT, `❌ Failed to save message: ${err}`);
      }
      return;
    }

    // ---- Event (join/leave from auth) ----
    if (type === MessageType.Event) {
      const { user, action, token } = parsed;
      if (!user || !action) return;

      if (action === "joined") {
        // Verify JWT token
        let userId = "";
        if (token) {
          const payload = verifyToken(token);
          if (!payload || payload.username !== user) {
            ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
            ws.close();
            return;
          }
          userId = payload.userId;
        }

        // Register user on this server instance
        userMap.set(user, { ws, userId, rooms: new Set() });
        await addOnlineUser(user);
        log(PORT, `📢 ${user} joined (tracked on this server)`);
      }

      if (action === "left") {
        userMap.delete(user);
        await removeOnlineUser(user);
        log(PORT, `📢 ${user} left`);
      }

      const payload: ChatPayload = {
        type: MessageType.Event,
        action,
        user,
        timestamp: Date.now(),
      };

      await publishChat(payload);
      await publishUserListUpdate();
      return;
    }

    // ---- Join Room (WebSocket-level room subscription) ----
    if (type === MessageType.JoinRoom) {
      const { roomId, user } = parsed;
      if (!roomId || !user) return;

      const entry = userMap.get(user);
      if (!entry) return;

      entry.rooms.add(roomId);
      await ensureRoomSubscription(roomId);
      log(PORT, `🚪 ${user} joined room ${roomId}`);

      // Notify the user they successfully joined
      ws.send(JSON.stringify({
        type: MessageType.JoinRoom,
        roomId,
        success: true,
      }));
      return;
    }

    // ---- Leave Room ----
    if (type === MessageType.LeaveRoom) {
      const { roomId, user } = parsed;
      if (!roomId || !user) return;

      const entry = userMap.get(user);
      if (entry) {
        entry.rooms.delete(roomId);
      }
      log(PORT, `🚪 ${user} left room ${roomId}`);
      return;
    }

    // ---- Code Editor Updates (room-scoped) ----
    if (
      type === MessageType.CodeUpdate ||
      type === MessageType.CodeLanguageChange ||
      type === MessageType.CodeSyncRequest ||
      type === MessageType.CodeSyncResponse
    ) {
      const { roomId, user } = parsed;
      if (!roomId || !user) return;

      const entry = userMap.get(user);
      if (!entry || !entry.rooms.has(roomId)) return;

      log(PORT, `📝 [${roomId}] ${type} from ${user}`);
      await publishToRoom(roomId, parsed);
      return;
    }

    // ---- WebRTC Signaling ----
    if (isSignalingMessage(type)) {
      await handleSignalingMessage(parsed, userMap);
      return;
    }

    log(PORT, `⚠️ Unknown message type: ${type}`);
  });

  // Disconnect Handler
  ws.on("close", async () => {
    const username = findUsernameByWs(userMap, ws);

    if (username) {
      userMap.delete(username);
      await removeOnlineUser(username);
      log(PORT, `🔴 ${username} disconnected`);

      const payload: ChatPayload = {
        type: MessageType.Event,
        action: "left",
        user: username,
        timestamp: Date.now(),
      };

      await publishChat(payload);
      await publishUserListUpdate();
    } else {
      log(PORT, `🔴 Unknown client disconnected (${wss.clients.size} active)`);
    }
  });

  ws.on("error", (err) => {
    log(PORT, `❌ WebSocket error: ${err.message}`);
  });
});

/* ================================
   HEARTBEAT CHECK
================================ */

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      const username = findUsernameByWs(userMap, ws);
      if (username) {
        userMap.delete(username);
        removeOnlineUser(username).then(() => publishUserListUpdate());
      }
      log(PORT, "💀 Terminating dead connection");
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

/* ================================
   GRACEFUL SHUTDOWN
================================ */

async function shutdown(): Promise<void> {
  log(PORT, "🛑 Shutting down...");
  clearInterval(heartbeatInterval);

  for (const username of userMap.keys()) {
    await removeOnlineUser(username);
  }
  userMap.clear();

  await prisma.$disconnect();
  await shutdownRedis();

  server.close(() => {
    log(PORT, "✅ Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
