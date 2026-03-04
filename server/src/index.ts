import { randomUUID } from "crypto";
import WebSocket, { WebSocketServer, RawData } from "ws";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CHAT_CHANNEL = "chat_channel";

/* ================================
   TYPES
================================ */

enum MessageType {
  Message = "message",
  Event = "event",
}

type ChatMessage = {
  id: string;
  type: MessageType.Message;
  user: string;
  content: string;
  timestamp: number;
  server: number;
};

type ChatEvent = {
  type: MessageType.Event;
  action: "joined" | "left";
  user: string;
  timestamp: number;
};

type ChatPayload = ChatMessage | ChatEvent;

/* ================================
   REDIS SETUP
================================ */

const publisher = new Redis(REDIS_URL);
const subscriber = publisher.duplicate();

publisher.on("error", (err) => {
  console.error(`❌ [Server ${PORT}] Redis Publisher Error:`, err);
});

subscriber.on("error", (err) => {
  console.error(`❌ [Server ${PORT}] Redis Subscriber Error:`, err);
});

subscriber.subscribe(CHAT_CHANNEL, (err, count) => {
  if (err) {
    console.error(`❌ Failed to subscribe to Redis channel:`, err);
  } else {
    console.log(`✅ Subscribed to Redis channel: ${CHAT_CHANNEL} (${count})`);
  }
});

/* ================================
   WEBSOCKET SERVER
================================ */

const wss = new WebSocketServer({
  port: PORT,
  host: "0.0.0.0",
});

console.log(`🚀 WebSocket server running on port ${PORT}`);

/* ================================
   HELPERS
================================ */

// Safe JSON parsing
function safeParse(message: RawData): any {
  try {
    return JSON.parse(message.toString());
  } catch {
    return null;
  }
}

// Broadcast to all connected clients
function broadcast(data: string, excludeWs?: WebSocket) {
  wss.clients.forEach((client) => {
    if (
      client !== excludeWs &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(data);
    }
  });
}

/* ================================
   REDIS LISTENER
================================ */

subscriber.on("message", (channel, message) => {
  if (channel !== CHAT_CHANNEL) return;

  console.log(
    `📨 [Server ${PORT}] Broadcasting to ${wss.clients.size} clients`
  );

  broadcast(message);
});

/* ================================
   CONNECTION HANDLER
================================ */

wss.on("connection", (ws: WebSocket) => {
  console.log(
    `🟢 [Server ${PORT}] Client connected (${wss.clients.size} active)`
  );

  // Heartbeat
  (ws as any).isAlive = true;

  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  // Message Handler
  ws.on("message", async (message: RawData) => {
    const parsed = safeParse(message);

    if (!parsed) {
      console.warn("⚠️ Invalid JSON received");
      return;
    }

    const { type, action, user, content } = parsed;
    let payload: ChatPayload | null = null;

    if (type === MessageType.Message) {
      if (!user || !content) return;

      payload = {
        id: randomUUID(),
        type: MessageType.Message,
        user,
        content,
        timestamp: Date.now(),
        server: PORT,
      };

      console.log(`💬 ${user}: ${content}`);
    }

    if (type === MessageType.Event) {
      if (!user || !action) return;

      payload = {
        type: MessageType.Event,
        action,
        user,
        timestamp: Date.now(),
      };

      console.log(`📢 ${user} ${action}`);
    }

    if (!payload) return;

    try {
      await publisher.publish(
        CHAT_CHANNEL,
        JSON.stringify(payload)
      );
    } catch (err) {
      console.error("❌ Redis publish failed:", err);
    }
  });

  ws.on("close", () => {
    console.log(
      `🔴 Client disconnected (${wss.clients.size} active)`
    );
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err);
  });
});

/* ================================
   HEARTBEAT CHECK
================================ */

const interval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      console.log("💀 Terminating dead connection");
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

/* ================================
   GRACEFUL SHUTDOWN
================================ */

async function shutdown() {
  console.log(`🛑 Shutting down server ${PORT}...`);
  clearInterval(interval);

  try {
    await publisher.quit();
    await subscriber.quit();
    console.log("✅ Redis connections closed");
  } catch (err) {
    console.error("❌ Redis shutdown error:", err);
  }

  wss.close(() => {
    console.log("✅ WebSocket server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
