"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const types_1 = require("./types");
const redis_1 = require("./redis");
const signaling_1 = require("./signaling");
const utils_1 = require("./utils");
/* ================================
   CONFIG
================================ */
const PORT = Number(process.env.PORT) || 5000;
/* ================================
   WEBSOCKET SERVER
================================ */
const wss = new ws_1.WebSocketServer({
    port: PORT,
    host: "0.0.0.0",
});
(0, utils_1.log)(PORT, `🚀 WebSocket server running on port ${PORT}`);
/* ================================
   USER REGISTRY
   Maps username → WebSocket on this server instance
================================ */
const userMap = new Map();
/* ================================
   BROADCAST ONLINE USERS
   Reads from Redis Set (cross-server) and sends to all local clients
================================ */
async function broadcastUserList() {
    try {
        const users = await (0, redis_1.getOnlineUsers)();
        const payload = JSON.stringify({
            type: types_1.MessageType.UserList,
            users: users.sort(),
        });
        (0, utils_1.broadcastToAll)(wss, payload);
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Failed to broadcast user list: ${err}`);
    }
}
/* ================================
   PUBLISH USER LIST TO ALL SERVERS
   Publishes an event so every server broadcasts the updated user list
================================ */
async function publishUserListUpdate() {
    try {
        const users = await (0, redis_1.getOnlineUsers)();
        const payload = JSON.stringify({
            type: types_1.MessageType.UserList,
            users: users.sort(),
        });
        // Publish on chat channel so all servers broadcast to their clients
        await redis_1.publisher.publish(redis_1.CHAT_CHANNEL, payload);
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Failed to publish user list update: ${err}`);
    }
}
/* ================================
   REDIS LISTENER
================================ */
redis_1.subscriber.on("message", (channel, message) => {
    if (channel === redis_1.CHAT_CHANNEL) {
        // Broadcast chat messages and user list updates to all local clients
        (0, utils_1.broadcastToAll)(wss, message);
    }
    else if (channel === redis_1.SIGNALING_CHANNEL) {
        // Deliver signaling messages to the target user on this server
        (0, signaling_1.handleSignalingFromRedis)(message, userMap);
    }
});
// Subscribe to channels
(0, redis_1.subscribeToChannels)();
/* ================================
   CONNECTION HANDLER
================================ */
wss.on("connection", (ws) => {
    (0, utils_1.log)(PORT, `🟢 Client connected (${wss.clients.size} active connections)`);
    // Heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
        ws.isAlive = true;
    });
    // Message Handler
    ws.on("message", async (message) => {
        const parsed = (0, utils_1.safeParse)(message);
        if (!parsed) {
            (0, utils_1.log)(PORT, "⚠️ Invalid JSON received");
            return;
        }
        const { type } = parsed;
        // ---- Chat Message ----
        if (type === types_1.MessageType.Message) {
            const { user, content } = parsed;
            if (!user || !content)
                return;
            const payload = {
                id: (0, crypto_1.randomUUID)(),
                type: types_1.MessageType.Message,
                user,
                content,
                timestamp: Date.now(),
                server: PORT,
            };
            (0, utils_1.log)(PORT, `💬 ${user}: ${content}`);
            await (0, redis_1.publishChat)(payload);
            return;
        }
        // ---- Event (join/leave) ----
        if (type === types_1.MessageType.Event) {
            const { user, action } = parsed;
            if (!user || !action)
                return;
            if (action === "joined") {
                // Register user on this server instance
                userMap.set(user, ws);
                await (0, redis_1.addOnlineUser)(user);
                (0, utils_1.log)(PORT, `📢 ${user} joined (tracked on this server)`);
            }
            if (action === "left") {
                userMap.delete(user);
                await (0, redis_1.removeOnlineUser)(user);
                (0, utils_1.log)(PORT, `📢 ${user} left`);
            }
            const payload = {
                type: types_1.MessageType.Event,
                action,
                user,
                timestamp: Date.now(),
            };
            await (0, redis_1.publishChat)(payload);
            // Broadcast updated user list to all servers
            await publishUserListUpdate();
            return;
        }
        // ---- WebRTC Signaling ----
        if ((0, signaling_1.isSignalingMessage)(type)) {
            await (0, signaling_1.handleSignalingMessage)(parsed, userMap);
            return;
        }
        (0, utils_1.log)(PORT, `⚠️ Unknown message type: ${type}`);
    });
    // Disconnect Handler
    ws.on("close", async () => {
        const username = (0, utils_1.findUsernameByWs)(userMap, ws);
        if (username) {
            userMap.delete(username);
            await (0, redis_1.removeOnlineUser)(username);
            (0, utils_1.log)(PORT, `🔴 ${username} disconnected`);
            // Notify others about the user leaving
            const payload = {
                type: types_1.MessageType.Event,
                action: "left",
                user: username,
                timestamp: Date.now(),
            };
            await (0, redis_1.publishChat)(payload);
            await publishUserListUpdate();
        }
        else {
            (0, utils_1.log)(PORT, `🔴 Unknown client disconnected (${wss.clients.size} active)`);
        }
    });
    ws.on("error", (err) => {
        (0, utils_1.log)(PORT, `❌ WebSocket error: ${err.message}`);
    });
});
/* ================================
   HEARTBEAT CHECK
================================ */
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            const username = (0, utils_1.findUsernameByWs)(userMap, ws);
            if (username) {
                userMap.delete(username);
                (0, redis_1.removeOnlineUser)(username).then(() => publishUserListUpdate());
            }
            (0, utils_1.log)(PORT, "💀 Terminating dead connection");
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
    (0, utils_1.log)(PORT, "🛑 Shutting down...");
    clearInterval(heartbeatInterval);
    // Remove all local users from Redis
    for (const username of userMap.keys()) {
        await (0, redis_1.removeOnlineUser)(username);
    }
    userMap.clear();
    await (0, redis_1.shutdownRedis)();
    wss.close(() => {
        (0, utils_1.log)(PORT, "✅ WebSocket server closed");
        process.exit(0);
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=index.js.map