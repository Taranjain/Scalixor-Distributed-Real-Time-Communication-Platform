import WebSocket, { RawData } from "ws";
import { UserMap } from "./types";
export declare function log(port: number, message: string): void;
export declare function safeParse(message: RawData): any;
export declare function broadcastToAll(wss: WebSocket.Server, data: string, excludeWs?: WebSocket): void;
export declare function sendToUser(userMap: UserMap, username: string, data: string): boolean;
export declare function broadcastToRoom(userMap: UserMap, roomId: string, data: string, excludeUsername?: string): void;
export declare function findUsernameByWs(userMap: UserMap, ws: WebSocket): string | undefined;
export declare function findEntryByWs(userMap: UserMap, ws: WebSocket): {
    username: string;
    userId: string;
    rooms: Set<string>;
} | undefined;
//# sourceMappingURL=utils.d.ts.map