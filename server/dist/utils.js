"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.safeParse = safeParse;
exports.broadcastToAll = broadcastToAll;
exports.sendToUser = sendToUser;
exports.findUsernameByWs = findUsernameByWs;
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
    const ws = userMap.get(username);
    if (ws && ws.readyState === ws_1.default.OPEN) {
        ws.send(data);
        return true;
    }
    return false;
}
/* ================================
   FIND USERNAME BY WEBSOCKET
================================ */
function findUsernameByWs(userMap, ws) {
    for (const [username, socket] of userMap.entries()) {
        if (socket === ws)
            return username;
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map