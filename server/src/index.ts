import { randomUUID } from "crypto";
import WebSocket, { WebSocketServer, RawData } from "ws";
import dotenv from "dotenv";

dotenv.config();

import { MessageType, ChatPayload, UserMap } from "./types";
import {
  publisher,
  subscriber,
  subscribeToChannels,
  publishChat,
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
import { safeParse, broadcastToAll, log, findUsernameByWs } from "./utils";

/* ================================
   CONFIG
================================ */

const PORT = Number(process.env.PORT) || 5000;

/* ================================
   WEBSOCKET SERVER
================================ */

const wss = new WebSocketServer({
  port: PORT,
  host: "0.0.0.0",
});

log(PORT, `🚀 WebSocket server running on port ${PORT}`);

/* ================================
   USER REGISTRY
   Maps username → WebSocket on this server instance
================================ */

const userMap: UserMap = new Map();

/* ================================
   BROADCAST ONLINE USERS
   Reads from Redis Set (cross-server) and sends to all local clients
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

/* ================================
   PUBLISH USER LIST TO ALL SERVERS
   Publishes an event so every server broadcasts the updated user list
================================ */

async function publishUserListUpdate(): Promise<void> {
  try {
    const users = await getOnlineUsers();
    const payload = JSON.stringify({
      type: MessageType.UserList,
      users: users.sort(),
    });
    // Publish on chat channel so all servers broadcast to their clients
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
    // Broadcast chat messages and user list updates to all local clients
    broadcastToAll(wss, message);
  } else if (channel === SIGNALING_CHANNEL) {
    // Deliver signaling messages to the target user on this server
    handleSignalingFromRedis(message, userMap);
  }
});

// Subscribe to channels
subscribeToChannels();

/* ================================
   CONNECTION HANDLER
================================ */

wss.on("connection", (ws: WebSocket) => {
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

    // ---- Chat Message ----
    if (type === MessageType.Message) {
      const { user, content } = parsed;
      if (!user || !content) return;

      const payload: ChatPayload = {
        id: randomUUID(),
        type: MessageType.Message,
        user,
        content,
        timestamp: Date.now(),
        server: PORT,
      };

      log(PORT, `💬 ${user}: ${content}`);
      await publishChat(payload);
      return;
    }

    // ---- Event (join/leave) ----
    if (type === MessageType.Event) {
      const { user, action } = parsed;
      if (!user || !action) return;

      if (action === "joined") {
        // Register user on this server instance
        userMap.set(user, ws);
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

      // Broadcast updated user list to all servers
      await publishUserListUpdate();
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

      // Notify others about the user leaving
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

  // Remove all local users from Redis
  for (const username of userMap.keys()) {
    await removeOnlineUser(username);
  }
  userMap.clear();

  await shutdownRedis();

  wss.close(() => {
    log(PORT, "✅ WebSocket server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
