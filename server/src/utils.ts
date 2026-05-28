import WebSocket, { RawData } from "ws";
import { UserMap } from "./types";

/* ================================
   LOGGING
================================ */

export function log(port: number, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Server ${port}] ${message}`);
}

/* ================================
   SAFE JSON PARSING
================================ */

export function safeParse(message: RawData): any {
    try {
        return JSON.parse(message.toString());
    } catch {
        return null;
    }
}

/* ================================
   BROADCAST TO ALL CLIENTS
================================ */

export function broadcastToAll(
    wss: WebSocket.Server,
    data: string,
    excludeWs?: WebSocket
): void {
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

/* ================================
   SEND TO SPECIFIC USER
================================ */

export function sendToUser(
    userMap: UserMap,
    username: string,
    data: string
): boolean {
    const entry = userMap.get(username);
    if (entry && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(data);
        return true;
    }
    return false;
}

/* ================================
   SEND TO ALL USERS IN A ROOM (on this server)
================================ */

export function broadcastToRoom(
    userMap: UserMap,
    roomId: string,
    data: string,
    excludeUsername?: string
): void {
    for (const [username, entry] of userMap.entries()) {
        if (username === excludeUsername) continue;
        if (entry.rooms.has(roomId) && entry.ws.readyState === WebSocket.OPEN) {
            entry.ws.send(data);
        }
    }
}

/* ================================
   FIND USERNAME BY WEBSOCKET
================================ */

export function findUsernameByWs(userMap: UserMap, ws: WebSocket): string | undefined {
    for (const [username, entry] of userMap.entries()) {
        if (entry.ws === ws) return username;
    }
    return undefined;
}

/* ================================
   FIND USER ENTRY BY WEBSOCKET
================================ */

export function findEntryByWs(userMap: UserMap, ws: WebSocket): { username: string; userId: string; rooms: Set<string> } | undefined {
    for (const [username, entry] of userMap.entries()) {
        if (entry.ws === ws) return { username, userId: entry.userId, rooms: entry.rooms };
    }
    return undefined;
}
