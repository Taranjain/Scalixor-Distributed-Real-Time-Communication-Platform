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
    const ws = userMap.get(username);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        return true;
    }
    return false;
}

/* ================================
   FIND USERNAME BY WEBSOCKET
================================ */

export function findUsernameByWs(userMap: UserMap, ws: WebSocket): string | undefined {
    for (const [username, socket] of userMap.entries()) {
        if (socket === ws) return username;
    }
    return undefined;
}
