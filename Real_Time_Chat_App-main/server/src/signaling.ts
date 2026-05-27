import { MessageType, SignalingMessage, UserMap } from "./types";
import { publishSignaling } from "./redis";
import { sendToUser, log } from "./utils";
import prisma from "./prisma";

const PORT = Number(process.env.PORT) || 5000;

/* ================================
   SIGNALING MESSAGE TYPES
================================ */

const SIGNALING_TYPES = new Set<string>([
    MessageType.Offer,
    MessageType.Answer,
    MessageType.IceCandidate,
    MessageType.CallRejected,
    MessageType.CallEnded,
]);

/* ================================
   ACTIVE CALLS TRACKER
================================ */

interface ActiveCall {
    callLogId: string;
    callerId: string;
    callerUsername: string;
    calleeId: string;
    calleeUsername: string;
    startedAt: Date;
}

const activeCalls = new Map<string, ActiveCall>();

function callKey(from: string, to: string): string {
    return [from, to].sort().join(":");
}

/* ================================
   NON-BLOCKING CALL LOG HELPERS
   (fire-and-forget — never delays signaling)
================================ */

function logCallStart(from: string, to: string, userMap: UserMap): void {
    const callerEntry = userMap.get(from);
    const calleeEntry = userMap.get(to);
    if (!callerEntry?.userId || !calleeEntry?.userId) return;

    prisma.callLog.create({
        data: {
            callerId: callerEntry.userId,
            calleeId: calleeEntry.userId,
            status: "missed",
        },
    }).then((callLog: { id: string }) => {
        activeCalls.set(callKey(from, to), {
            callLogId: callLog.id,
            callerId: callerEntry.userId,
            callerUsername: from,
            calleeId: calleeEntry.userId,
            calleeUsername: to,
            startedAt: new Date(),
        });
        log(PORT, `📞 CallLog created: ${callLog.id}`);
    }).catch((err: unknown) => {
        log(PORT, `❌ Failed to create call log: ${err}`);
    });
}

function logCallAnswer(from: string, to: string): void {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active) return;

    prisma.callLog.update({
        where: { id: active.callLogId },
        data: { status: "in-progress" },
    }).catch((err: unknown) => {
        log(PORT, `❌ Failed to update call log: ${err}`);
    });
}

function logCallRejected(from: string, to: string): void {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active) return;

    prisma.callLog.update({
        where: { id: active.callLogId },
        data: { status: "rejected", endedAt: new Date(), duration: 0 },
    }).then(() => {
        activeCalls.delete(key);
    }).catch((err: unknown) => {
        log(PORT, `❌ Failed to update call log: ${err}`);
    });
}

function logCallEnded(from: string, to: string): void {
    const key = callKey(from, to);
    const active = activeCalls.get(key);
    if (!active) return;

    const endedAt = new Date();
    const duration = Math.round((endedAt.getTime() - active.startedAt.getTime()) / 1000);

    prisma.callLog.update({
        where: { id: active.callLogId },
        data: { status: "completed", endedAt, duration },
    }).then(() => {
        activeCalls.delete(key);
        log(PORT, `📞 Call completed: ${duration}s`);
    }).catch((err: unknown) => {
        log(PORT, `❌ Failed to finalize call log: ${err}`);
    });
}

/* ================================
   CHECK IF SIGNALING MESSAGE
================================ */

export function isSignalingMessage(type: string): boolean {
    return SIGNALING_TYPES.has(type);
}

/* ================================
   HANDLE INCOMING SIGNALING
   (from WebSocket client → Redis)
   CRITICAL: Publish to Redis FIRST, then log asynchronously
================================ */

export async function handleSignalingMessage(
    parsed: SignalingMessage,
    userMap: UserMap
): Promise<void> {
    const { type, from, to } = parsed;

    if (!from || !to) {
        log(PORT, `⚠️ Signaling message missing from/to fields`);
        return;
    }

    log(PORT, `🔀 Signaling [${type}] from "${from}" → "${to}"`);

    // ★ PUBLISH FIRST — never delay signaling for database operations
    await publishSignaling(parsed);

    // ★ Then log call events (fire-and-forget, non-blocking)
    if (type === MessageType.Offer) {
        logCallStart(from, to, userMap);
    } else if (type === MessageType.Answer) {
        logCallAnswer(from, to);
    } else if (type === MessageType.CallRejected) {
        logCallRejected(from, to);
    } else if (type === MessageType.CallEnded) {
        logCallEnded(from, to);
    }
}

/* ================================
   HANDLE SIGNALING FROM REDIS
   (Redis → target WebSocket client)
================================ */

export function handleSignalingFromRedis(
    message: string,
    userMap: UserMap
): void {
    let parsed: SignalingMessage;
    try {
        parsed = JSON.parse(message);
    } catch {
        log(PORT, `⚠️ Failed to parse signaling message from Redis`);
        return;
    }

    const { to } = parsed;

    if (!to) return;

    const delivered = sendToUser(userMap, to, message);
    if (delivered) {
        log(PORT, `📨 Delivered signaling [${parsed.type}] to "${to}"`);
    }
}
