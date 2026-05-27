"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSignalingMessage = isSignalingMessage;
exports.handleSignalingMessage = handleSignalingMessage;
exports.handleSignalingFromRedis = handleSignalingFromRedis;
const types_1 = require("./types");
const redis_1 = require("./redis");
const utils_1 = require("./utils");
const PORT = Number(process.env.PORT) || 5000;
/* ================================
   SIGNALING MESSAGE TYPES
================================ */
const SIGNALING_TYPES = new Set([
    types_1.MessageType.Offer,
    types_1.MessageType.Answer,
    types_1.MessageType.IceCandidate,
    types_1.MessageType.CallRejected,
    types_1.MessageType.CallEnded,
]);
/* ================================
   CHECK IF SIGNALING MESSAGE
================================ */
function isSignalingMessage(type) {
    return SIGNALING_TYPES.has(type);
}
/* ================================
   HANDLE INCOMING SIGNALING
   (from WebSocket client → Redis)
================================ */
async function handleSignalingMessage(parsed, _userMap) {
    const { type, from, to } = parsed;
    if (!from || !to) {
        (0, utils_1.log)(PORT, `⚠️ Signaling message missing from/to fields`);
        return;
    }
    (0, utils_1.log)(PORT, `🔀 Signaling [${type}] from "${from}" → "${to}"`);
    // Publish to Redis so all server instances can try to deliver
    await (0, redis_1.publishSignaling)(parsed);
}
/* ================================
   HANDLE SIGNALING FROM REDIS
   (Redis → target WebSocket client)
================================ */
function handleSignalingFromRedis(message, userMap) {
    let parsed;
    try {
        parsed = JSON.parse(message);
    }
    catch {
        (0, utils_1.log)(PORT, `⚠️ Failed to parse signaling message from Redis`);
        return;
    }
    const { to } = parsed;
    if (!to)
        return;
    // Try to deliver to the target user on this server instance
    const delivered = (0, utils_1.sendToUser)(userMap, to, message);
    if (delivered) {
        (0, utils_1.log)(PORT, `📨 Delivered signaling [${parsed.type}] to "${to}"`);
    }
}
//# sourceMappingURL=signaling.js.map