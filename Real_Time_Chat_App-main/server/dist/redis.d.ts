import Redis from "ioredis";
export declare const CHAT_CHANNEL = "chat_channel";
export declare const SIGNALING_CHANNEL = "signaling_channel";
export declare const ONLINE_USERS_KEY = "online_users";
export declare const publisher: Redis;
export declare const subscriber: Redis;
export declare function subscribeToChannels(): Promise<void>;
export declare function publishChat(payload: object): Promise<void>;
export declare function publishSignaling(payload: object): Promise<void>;
export declare function addOnlineUser(username: string): Promise<void>;
export declare function removeOnlineUser(username: string): Promise<void>;
export declare function getOnlineUsers(): Promise<string[]>;
export declare function shutdownRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map