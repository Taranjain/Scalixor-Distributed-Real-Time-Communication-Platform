import WebSocket from "ws";
export declare enum MessageType {
    Message = "message",
    Event = "event",
    Offer = "offer",
    Answer = "answer",
    IceCandidate = "ice-candidate",
    UserList = "user-list",
    CallRejected = "call-rejected",
    CallEnded = "call-ended",
    RoomMessage = "room-message",
    JoinRoom = "join-room",
    LeaveRoom = "leave-room",
    RoomUserList = "room-user-list",
    CodeUpdate = "code-update",
    CodeLanguageChange = "code-language-change"
}
export type ChatMessage = {
    id: string;
    type: MessageType.Message;
    user: string;
    content: string;
    roomId: string;
    timestamp: number;
    server: number;
};
export type ChatEvent = {
    type: MessageType.Event;
    action: "joined" | "left";
    user: string;
    roomId?: string;
    timestamp: number;
};
export type RoomJoin = {
    type: MessageType.JoinRoom;
    roomId: string;
    user: string;
};
export type RoomLeave = {
    type: MessageType.LeaveRoom;
    roomId: string;
    user: string;
};
export type SignalOffer = {
    type: MessageType.Offer;
    from: string;
    to: string;
    sdp: object;
};
export type SignalAnswer = {
    type: MessageType.Answer;
    from: string;
    to: string;
    sdp: object;
};
export type SignalIceCandidate = {
    type: MessageType.IceCandidate;
    from: string;
    to: string;
    candidate: object;
};
export type CallRejected = {
    type: MessageType.CallRejected;
    from: string;
    to: string;
};
export type CallEnded = {
    type: MessageType.CallEnded;
    from: string;
    to: string;
};
export type SignalingMessage = SignalOffer | SignalAnswer | SignalIceCandidate | CallRejected | CallEnded;
export type UserListUpdate = {
    type: MessageType.UserList;
    users: string[];
};
export type CodeUpdatePayload = {
    type: MessageType.CodeUpdate;
    roomId: string;
    update: string;
    user: string;
};
export type CodeLanguageChangePayload = {
    type: MessageType.CodeLanguageChange;
    roomId: string;
    language: string;
    user: string;
};
export type ChatPayload = ChatMessage | ChatEvent;
export type IncomingMessage = ChatPayload | SignalingMessage | RoomJoin | RoomLeave | CodeUpdatePayload | CodeLanguageChangePayload;
export interface UserEntry {
    ws: WebSocket;
    userId: string;
    rooms: Set<string>;
}
export type UserMap = Map<string, UserEntry>;
//# sourceMappingURL=types.d.ts.map