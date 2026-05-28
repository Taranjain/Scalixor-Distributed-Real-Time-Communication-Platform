"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSignalingMessage = isSignalingMessage;
exports.handleSignalingMessage = handleSignalingMessage;
exports.handleSignalingFromRedis = handleSignalingFromRedis;
const types_1 = require("./types");
const redis_1 = require("./redis");
const utils_1 = require("./utils");
const prisma_1 = __importDefault(require("./prisma"));
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
const activeCalls = new Map();
function callKey(from, to) {
    return [from, to].sort().join(":");
}
/* ================================
   NON-BLOCKING CALL LOG HELPERS
   (fire-and-forget — never delays signaling)
================================ */
function logCallStart(from, to, userMap) {
    const callerEntry = userMap.get(from);
    const calleeEntry = userMap.get(to);
    if (!callerEntry?.userId || !calleeEntry?.userId)
        return;
    prisma_1.default.callLog.create({
        data: {
            callerId: callerEntry.userId,
            calleeId: calleeEntry.userId,
            status: "missed",
        },
    }).then((callLog) => {
        activeCalls.set(callKey(from, to), {
            callLogId: callLog.id,
            callerId: callerEntry.userId,
            callerUsername: from,
            calleeId: calleeEntry.userId,
            calleeUsername: to,
            startedAt: new Date(),
        });
        (0, utils_1.log)(PORT, `📞 CallLog created: ${callLog.id}`);
    }).catch((err) => {
        (0, utils_1.log)(PORT, `❌ Failed to create call log: ${err}`);
    });
}
function logCallAnswer(from, to) {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active)
        return;
    prisma_1.default.callLog.update({
        where: { id: active.callLogId },
        data: { status: "in-progress" },
    }).catch((err) => {
        (0, utils_1.log)(PORT, `❌ Failed to update call log: ${err}`);
    });
}
function logCallRejected(from, to) {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active)
        return;
    prisma_1.default.callLog.update({
        where: { id: active.callLogId },
        data: { status: "rejected", endedAt: new Date(), duration: 0 },
    }).then(() => {
        activeCalls.delete(key);
    }).catch((err) => {
        (0, utils_1.log)(PORT, `❌ Failed to update call log: ${err}`);
    });
}
function logCallEnded(from, to) {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active)
        return;
    const endedAt = new Date();
    const duration = Math.round((endedAt.getTime() - active.startedAt.getTime()) / 1000);
    prisma_1.default.callLog.update({
        where: { id: active.callLogId },
        data: { status: "completed", endedAt, duration },
    }).then(() => {
        activeCalls.delete(key);
        (0, utils_1.log)(PORT, `📞 Call completed: ${duration}s`);
    }).catch((err) => {
        (0, utils_1.log)(PORT, `❌ Failed to finalize call log: ${err}`);
    });
}
/* ================================
   CHECK IF SIGNALING MESSAGE
================================ */
function isSignalingMessage(type) {
    return SIGNALING_TYPES.has(type);
}
/* ================================
   HANDLE INCOMING SIGNALING
   (from WebSocket client → Redis)
   CRITICAL: Publish to Redis FIRST, then log asynchronously
================================ */
async function handleSignalingMessage(parsed, userMap) {
    const { type, from, to } = parsed;
    if (!from || !to) {
        (0, utils_1.log)(PORT, `⚠️ Signaling message missing from/to fields`);
        return;
    }
    (0, utils_1.log)(PORT, `🔀 Signaling [${type}] from "${from}" → "${to}"`);
    // ★ PUBLISH FIRST — never delay signaling for database operations
    await (0, redis_1.publishSignaling)(parsed);
    // ★ Then log call events (fire-and-forget, non-blocking)
    if (type === types_1.MessageType.Offer) {
        logCallStart(from, to, userMap);
    }
    else if (type === types_1.MessageType.Answer) {
        logCallAnswer(from, to);
    }
    else if (type === types_1.MessageType.CallRejected) {
        logCallRejected(from, to);
    }
    else if (type === types_1.MessageType.CallEnded) {
        logCallEnded(from, to);
    }
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
    const delivered = (0, utils_1.sendToUser)(userMap, to, message);
    if (delivered) {
        (0, utils_1.log)(PORT, `📨 Delivered signaling [${parsed.type}] to "${to}"`);
    }
}
//# sourceMappingURL=signaling.js.map