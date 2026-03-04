import Redis from "ioredis";
import { log } from "./utils";

/* ================================
   CONSTANTS
================================ */

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const PORT = Number(process.env.PORT) || 5000;

export const CHAT_CHANNEL = "chat_channel";
export const SIGNALING_CHANNEL = "signaling_channel";
export const ONLINE_USERS_KEY = "online_users";

/* ================================
   REDIS CLIENTS
================================ */

export const publisher = new Redis(REDIS_URL);
export const subscriber = publisher.duplicate();

publisher.on("error", (err) => {
    log(PORT, `❌ Redis Publisher Error: ${err.message}`);
});

subscriber.on("error", (err) => {
    log(PORT, `❌ Redis Subscriber Error: ${err.message}`);
});

/* ================================
   SUBSCRIBE TO CHANNELS
================================ */

export async function subscribeToChannels(): Promise<void> {
    try {
        const count = await subscriber.subscribe(CHAT_CHANNEL, SIGNALING_CHANNEL);
        log(PORT, `✅ Subscribed to ${count} Redis channel(s): ${CHAT_CHANNEL}, ${SIGNALING_CHANNEL}`);
    } catch (err) {
        log(PORT, `❌ Failed to subscribe to Redis channels: ${err}`);
    }
}

/* ================================
   PUBLISH HELPERS
================================ */

export async function publishChat(payload: object): Promise<void> {
    try {
        await publisher.publish(CHAT_CHANNEL, JSON.stringify(payload));
    } catch (err) {
        log(PORT, `❌ Redis chat publish failed: ${err}`);
    }
}

export async function publishSignaling(payload: object): Promise<void> {
    try {
        await publisher.publish(SIGNALING_CHANNEL, JSON.stringify(payload));
    } catch (err) {
        log(PORT, `❌ Redis signaling publish failed: ${err}`);
    }
}

/* ================================
   ONLINE USERS (REDIS SET)
================================ */

export async function addOnlineUser(username: string): Promise<void> {
    await publisher.sadd(ONLINE_USERS_KEY, username);
}

export async function removeOnlineUser(username: string): Promise<void> {
    await publisher.srem(ONLINE_USERS_KEY, username);
}

export async function getOnlineUsers(): Promise<string[]> {
    return publisher.smembers(ONLINE_USERS_KEY);
}

/* ================================
   GRACEFUL SHUTDOWN
================================ */

export async function shutdownRedis(): Promise<void> {
    try {
        await publisher.quit();
        await subscriber.quit();
        log(PORT, "✅ Redis connections closed");
    } catch (err) {
        log(PORT, `❌ Redis shutdown error: ${err}`);
    }
}
