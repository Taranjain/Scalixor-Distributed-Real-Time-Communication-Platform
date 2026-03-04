"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ws_1 = __importStar(require("ws"));
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 5000;
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CHAT_CHANNEL = "chat_channel";
/* ================================
   TYPES
================================ */
var MessageType;
(function (MessageType) {
    MessageType["Message"] = "message";
    MessageType["Event"] = "event";
})(MessageType || (MessageType = {}));
/* ================================
   REDIS SETUP
================================ */
const publisher = new ioredis_1.default(REDIS_URL);
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
    }
    else {
        console.log(`✅ Subscribed to Redis channel: ${CHAT_CHANNEL} (${count})`);
    }
});
/* ================================
   WEBSOCKET SERVER
================================ */
const wss = new ws_1.WebSocketServer({
    port: PORT,
    host: "0.0.0.0",
});
console.log(`🚀 WebSocket server running on port ${PORT}`);
/* ================================
   HELPERS
================================ */
// Safe JSON parsing
function safeParse(message) {
    try {
        return JSON.parse(message.toString());
    }
    catch {
        return null;
    }
}
// Broadcast to all connected clients
function broadcast(data, excludeWs) {
    wss.clients.forEach((client) => {
        if (client !== excludeWs &&
            client.readyState === ws_1.default.OPEN) {
            client.send(data);
        }
    });
}
/* ================================
   REDIS LISTENER
================================ */
subscriber.on("message", (channel, message) => {
    if (channel !== CHAT_CHANNEL)
        return;
    console.log(`📨 [Server ${PORT}] Broadcasting to ${wss.clients.size} clients`);
    broadcast(message);
});
/* ================================
   CONNECTION HANDLER
================================ */
wss.on("connection", (ws) => {
    console.log(`🟢 [Server ${PORT}] Client connected (${wss.clients.size} active)`);
    // Heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
        ws.isAlive = true;
    });
    // Message Handler
    ws.on("message", async (message) => {
        const parsed = safeParse(message);
        if (!parsed) {
            console.warn("⚠️ Invalid JSON received");
            return;
        }
        const { type, action, user, content } = parsed;
        let payload = null;
        if (type === MessageType.Message) {
            if (!user || !content)
                return;
            payload = {
                id: (0, crypto_1.randomUUID)(),
                type: MessageType.Message,
                user,
                content,
                timestamp: Date.now(),
                server: PORT,
            };
            console.log(`💬 ${user}: ${content}`);
        }
        if (type === MessageType.Event) {
            if (!user || !action)
                return;
            payload = {
                type: MessageType.Event,
                action,
                user,
                timestamp: Date.now(),
            };
            console.log(`📢 ${user} ${action}`);
        }
        if (!payload)
            return;
        try {
            await publisher.publish(CHAT_CHANNEL, JSON.stringify(payload));
        }
        catch (err) {
            console.error("❌ Redis publish failed:", err);
        }
    });
    ws.on("close", () => {
        console.log(`🔴 Client disconnected (${wss.clients.size} active)`);
    });
    ws.on("error", (err) => {
        console.error("❌ WebSocket error:", err);
    });
});
/* ================================
   HEARTBEAT CHECK
================================ */
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
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
    }
    catch (err) {
        console.error("❌ Redis shutdown error:", err);
    }
    wss.close(() => {
        console.log("✅ WebSocket server closed");
        process.exit(0);
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=index.js.map