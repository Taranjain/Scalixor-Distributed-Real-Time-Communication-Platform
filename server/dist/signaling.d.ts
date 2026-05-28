import { SignalingMessage, UserMap } from "./types";
export declare function isSignalingMessage(type: string): boolean;
export declare function handleSignalingMessage(parsed: SignalingMessage, userMap: UserMap): Promise<void>;
export declare function handleSignalingFromRedis(message: string, userMap: UserMap): void;
//# sourceMappingURL=signaling.d.ts.map