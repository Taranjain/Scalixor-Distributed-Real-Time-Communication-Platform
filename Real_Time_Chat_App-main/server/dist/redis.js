"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriber = exports.publisher = exports.ONLINE_USERS_KEY = exports.SIGNALING_CHANNEL = exports.CHAT_CHANNEL = void 0;
exports.subscribeToChannels = subscribeToChannels;
exports.publishChat = publishChat;
exports.publishSignaling = publishSignaling;
exports.addOnlineUser = addOnlineUser;
exports.removeOnlineUser = removeOnlineUser;
exports.getOnlineUsers = getOnlineUsers;
exports.shutdownRedis = shutdownRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const utils_1 = require("./utils");
/* ================================
   CONSTANTS
================================ */
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const PORT = Number(process.env.PORT) || 5000;
exports.CHAT_CHANNEL = "chat_channel";
exports.SIGNALING_CHANNEL = "signaling_channel";
exports.ONLINE_USERS_KEY = "online_users";
/* ================================
   REDIS CLIENTS
================================ */
exports.publisher = new ioredis_1.default(REDIS_URL);
exports.subscriber = exports.publisher.duplicate();
exports.publisher.on("error", (err) => {
    (0, utils_1.log)(PORT, `❌ Redis Publisher Error: ${err.message}`);
});
exports.subscriber.on("error", (err) => {
    (0, utils_1.log)(PORT, `❌ Redis Subscriber Error: ${err.message}`);
});
/* ================================
   SUBSCRIBE TO CHANNELS
================================ */
async function subscribeToChannels() {
    try {
        const count = await exports.subscriber.subscribe(exports.CHAT_CHANNEL, exports.SIGNALING_CHANNEL);
        (0, utils_1.log)(PORT, `✅ Subscribed to ${count} Redis channel(s): ${exports.CHAT_CHANNEL}, ${exports.SIGNALING_CHANNEL}`);
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Failed to subscribe to Redis channels: ${err}`);
    }
}
/* ================================
   PUBLISH HELPERS
================================ */
async function publishChat(payload) {
    try {
        await exports.publisher.publish(exports.CHAT_CHANNEL, JSON.stringify(payload));
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Redis chat publish failed: ${err}`);
    }
}
async function publishSignaling(payload) {
    try {
        await exports.publisher.publish(exports.SIGNALING_CHANNEL, JSON.stringify(payload));
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Redis signaling publish failed: ${err}`);
    }
}
/* ================================
   ONLINE USERS (REDIS SET)
================================ */
async function addOnlineUser(username) {
    await exports.publisher.sadd(exports.ONLINE_USERS_KEY, username);
}
async function removeOnlineUser(username) {
    await exports.publisher.srem(exports.ONLINE_USERS_KEY, username);
}
async function getOnlineUsers() {
    return exports.publisher.smembers(exports.ONLINE_USERS_KEY);
}
/* ================================
   GRACEFUL SHUTDOWN
================================ */
async function shutdownRedis() {
    try {
        await exports.publisher.quit();
        await exports.subscriber.quit();
        (0, utils_1.log)(PORT, "✅ Redis connections closed");
    }
    catch (err) {
        (0, utils_1.log)(PORT, `❌ Redis shutdown error: ${err}`);
    }
}
//# sourceMappingURL=redis.js.map