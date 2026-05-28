"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.safeParse = safeParse;
exports.broadcastToAll = broadcastToAll;
exports.sendToUser = sendToUser;
exports.broadcastToRoom = broadcastToRoom;
exports.findUsernameByWs = findUsernameByWs;
exports.findEntryByWs = findEntryByWs;
const ws_1 = __importDefault(require("ws"));
/* ================================
   LOGGING
================================ */
function log(port, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Server ${port}] ${message}`);
}
/* ================================
   SAFE JSON PARSING
================================ */
function safeParse(message) {
    try {
        return JSON.parse(message.toString());
    }
    catch {
        return null;
    }
}
/* ================================
   BROADCAST TO ALL CLIENTS
================================ */
function broadcastToAll(wss, data, excludeWs) {
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === ws_1.default.OPEN) {
            client.send(data);
        }
    });
}
/* ================================
   SEND TO SPECIFIC USER
================================ */
function sendToUser(userMap, username, data) {
    const entry = userMap.get(username);
    if (entry && entry.ws.readyState === ws_1.default.OPEN) {
        entry.ws.send(data);
        return true;
    }
    return false;
}
/* ================================
   SEND TO ALL USERS IN A ROOM (on this server)
================================ */
function broadcastToRoom(userMap, roomId, data, excludeUsername) {
    for (const [username, entry] of userMap.entries()) {
        if (username === excludeUsername)
            continue;
        if (entry.rooms.has(roomId) && entry.ws.readyState === ws_1.default.OPEN) {
            entry.ws.send(data);
        }
    }
}
/* ================================
   FIND USERNAME BY WEBSOCKET
================================ */
function findUsernameByWs(userMap, ws) {
    for (const [username, entry] of userMap.entries()) {
        if (entry.ws === ws)
            return username;
    }
    return undefined;
}
/* ================================
   FIND USER ENTRY BY WEBSOCKET
================================ */
function findEntryByWs(userMap, ws) {
    for (const [username, entry] of userMap.entries()) {
        if (entry.ws === ws)
            return { username, userId: entry.userId, rooms: entry.rooms };
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map