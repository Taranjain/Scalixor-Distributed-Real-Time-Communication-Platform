"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const types_1 = require("./types");
const redis_1 = require("./redis");
const signaling_1 = require("./signaling");
const utils_1 = require("./utils");
const auth_1 = require("./auth");
const prisma_1 = __importDefault(require("./prisma"));
const routes_1 = __importDefault(require("./routes"));
/* ================================
   CONFIG
================================ */
const PORT = Number(process.env.PORT) || 5000;
/* ================================
   EXPRESS APP
================================ */
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(routes_1.default);
/* health check */
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", port: PORT });
});
/* ================================
   HTTP + WEBSOCKET SERVER
================================ */
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
server.listen(PORT, "0.0.0.0", () => {
    (0, utils_1.log)(PORT, `🚀 HTTP + WebSocket server running on port ${PORT}`);
});
/* ================================
   USER REGISTRY
================================ */
const userMap = new Map();
/* Track which room channels this server instance is subscribed to */
const subscribedRooms = new Set();
/* ================================
   BROADCAST ONLINE USERS
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
async function publishUserListUpdate() {
    try {
        const users = await (0, redis_1.getOnlineUsers)();
        const payload = JSON.stringify({
            type: types_1.MessageType.UserList,
            users: users.sort(),
        });
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
        (0, utils_1.broadcastToAll)(wss, message);
    }
    else if (channel === redis_1.SIGNALING_CHANNEL) {
        (0, signaling_1.handleSignalingFromRedis)(message, userMap);
    }
    else if (channel.startsWith("room:")) {
        // Room-scoped message — deliver to local users in that room
        const roomId = channel.replace("room:", "");
        (0, utils_1.broadcastToRoom)(userMap, roomId, message);
    }
});
(0, redis_1.subscribeToChannels)();
/* ================================
   ENSURE ROOM SUBSCRIPTION
================================ */
async function ensureRoomSubscription(roomId) {
    if (!subscribedRooms.has(roomId)) {
        await (0, redis_1.subscribeToRoom)(roomId);
        subscribedRooms.add(roomId);
    }
}
/* ================================
   CONNECTION HANDLER
================================ */
wss.on("connection", (ws, req) => {
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
        // ---- Chat Message (room-scoped) ----
        if (type === types_1.MessageType.Message) {
            const { user, content, roomId } = parsed;
            if (!user || !content || !roomId)
                return;
            const entry = userMap.get(user);
            if (!entry)
                return;
            // Save message to database
            try {
                const dbMessage = await prisma_1.default.message.create({
                    data: {
                        content,
                        senderId: entry.userId,
                        roomId,
                    },
                });
                const payload = {
                    id: dbMessage.id,
                    type: types_1.MessageType.Message,
                    user,
                    content,
                    roomId,
                    timestamp: dbMessage.createdAt.getTime(),
                    server: PORT,
                };
                (0, utils_1.log)(PORT, `💬 [${roomId}] ${user}: ${content}`);
                await (0, redis_1.publishToRoom)(roomId, payload);
            }
            catch (err) {
                (0, utils_1.log)(PORT, `❌ Failed to save message: ${err}`);
            }
            return;
        }
        // ---- Event (join/leave from auth) ----
        if (type === types_1.MessageType.Event) {
            const { user, action, token } = parsed;
            if (!user || !action)
                return;
            if (action === "joined") {
                // Verify JWT token
                let userId = "";
                if (token) {
                    const payload = (0, auth_1.verifyToken)(token);
                    if (!payload || payload.username !== user) {
                        ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
                        ws.close();
                        return;
                    }
                    userId = payload.userId;
                }
                // Register user on this server instance
                userMap.set(user, { ws, userId, rooms: new Set() });
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
            await publishUserListUpdate();
            return;
        }
        // ---- Join Room (WebSocket-level room subscription) ----
        if (type === types_1.MessageType.JoinRoom) {
            const { roomId, user } = parsed;
            if (!roomId || !user)
                return;
            const entry = userMap.get(user);
            if (!entry)
                return;
            entry.rooms.add(roomId);
            await ensureRoomSubscription(roomId);
            (0, utils_1.log)(PORT, `🚪 ${user} joined room ${roomId}`);
            // Notify the user they successfully joined
            ws.send(JSON.stringify({
                type: types_1.MessageType.JoinRoom,
                roomId,
                success: true,
            }));
            return;
        }
        // ---- Leave Room ----
        if (type === types_1.MessageType.LeaveRoom) {
            const { roomId, user } = parsed;
            if (!roomId || !user)
                return;
            const entry = userMap.get(user);
            if (entry) {
                entry.rooms.delete(roomId);
            }
            (0, utils_1.log)(PORT, `🚪 ${user} left room ${roomId}`);
            return;
        }
        // ---- Code Editor Updates (room-scoped) ----
        if (type === types_1.MessageType.CodeUpdate || type === types_1.MessageType.CodeLanguageChange) {
            const { roomId, user } = parsed;
            if (!roomId || !user)
                return;
            const entry = userMap.get(user);
            if (!entry || !entry.rooms.has(roomId))
                return;
            (0, utils_1.log)(PORT, `📝 [${roomId}] ${type} from ${user}`);
            await (0, redis_1.publishToRoom)(roomId, parsed);
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
    for (const username of userMap.keys()) {
        await (0, redis_1.removeOnlineUser)(username);
    }
    userMap.clear();
    await prisma_1.default.$disconnect();
    await (0, redis_1.shutdownRedis)();
    server.close(() => {
        (0, utils_1.log)(PORT, "✅ Server closed");
        process.exit(0);
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=index.js.map