import WebSocket from "ws";

/* ================================
   MESSAGE TYPES
================================ */

export enum MessageType {
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
    CodeLanguageChange = "code-language-change",
    CodeSyncRequest = "code-sync-request",
    CodeSyncResponse = "code-sync-response",
}

/* ================================
   CHAT TYPES
================================ */

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

/* ================================
   ROOM TYPES
================================ */

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

/* ================================
   WEBRTC SIGNALING TYPES
================================ */

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

export type SignalingMessage =
    | SignalOffer
    | SignalAnswer
    | SignalIceCandidate
    | CallRejected
    | CallEnded;

/* ================================
   USER LIST TYPES
================================ */

export type UserListUpdate = {
    type: MessageType.UserList;
    users: string[];
};

/* ================================
    CODE EDITOR TYPES
   ================================ */

export type CodeUpdatePayload = {
    type: MessageType.CodeUpdate;
    roomId: string;
    update: string; // base64-encoded Yjs update
    user: string;
};

export type CodeLanguageChangePayload = {
    type: MessageType.CodeLanguageChange;
    roomId: string;
    language: string;
    user: string;
};

export type CodeSyncRequestPayload = {
    type: MessageType.CodeSyncRequest;
    roomId: string;
    user: string;
};

export type CodeSyncResponsePayload = {
    type: MessageType.CodeSyncResponse;
    roomId: string;
    update: string; // base64-encoded full Yjs state
    user: string;
};

/* ================================
    COMBINED PAYLOAD
   ================================ */

export type ChatPayload = ChatMessage | ChatEvent;

export type IncomingMessage = ChatPayload | SignalingMessage | RoomJoin | RoomLeave | CodeUpdatePayload | CodeLanguageChangePayload | CodeSyncRequestPayload | CodeSyncResponsePayload;

/* ================================
   USER MAP — username → { ws, userId, rooms }
================================ */

export interface UserEntry {
    ws: WebSocket;
    userId: string;
    rooms: Set<string>;  // roomIds the user has joined in this session
}

export type UserMap = Map<string, UserEntry>;
