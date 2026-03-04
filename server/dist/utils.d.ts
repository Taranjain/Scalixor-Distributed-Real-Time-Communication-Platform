import WebSocket, { RawData } from "ws";
import { UserMap } from "./types";
export declare function log(port: number, message: string): void;
export declare function safeParse(message: RawData): any;
export declare function broadcastToAll(wss: WebSocket.Server, data: string, excludeWs?: WebSocket): void;
export declare function sendToUser(userMap: UserMap, username: string, data: string): boolean;
export declare function findUsernameByWs(userMap: UserMap, ws: WebSocket): string | undefined;
//# sourceMappingURL=utils.d.ts.map