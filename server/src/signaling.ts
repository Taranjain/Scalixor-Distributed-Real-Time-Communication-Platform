import { MessageType, SignalingMessage, UserMap } from "./types";
import { publishSignaling } from "./redis";
import { sendToUser, log } from "./utils";

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
   CHECK IF SIGNALING MESSAGE
================================ */

export function isSignalingMessage(type: string): boolean {
    return SIGNALING_TYPES.has(type);
}

/* ================================
   HANDLE INCOMING SIGNALING
   (from WebSocket client → Redis)
================================ */

export async function handleSignalingMessage(
    parsed: SignalingMessage,
    _userMap: UserMap
): Promise<void> {
    const { type, from, to } = parsed;

    if (!from || !to) {
        log(PORT, `⚠️ Signaling message missing from/to fields`);
        return;
    }

    log(PORT, `🔀 Signaling [${type}] from "${from}" → "${to}"`);

    // Publish to Redis so all server instances can try to deliver
    await publishSignaling(parsed);
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

    // Try to deliver to the target user on this server instance
    const delivered = sendToUser(userMap, to, message);
    if (delivered) {
        log(PORT, `📨 Delivered signaling [${parsed.type}] to "${to}"`);
    }
}
