import WebSocket from "ws";
export declare enum MessageType {
    Message = "message",
    Event = "event",
    Offer = "offer",
    Answer = "answer",
    IceCandidate = "ice-candidate",
    UserList = "user-list",
    CallRejected = "call-rejected",
    CallEnded = "call-ended"
}
export type ChatMessage = {
    id: string;
    type: MessageType.Message;
    user: string;
    content: string;
    timestamp: number;
    server: number;
};
export type ChatEvent = {
    type: MessageType.Event;
    action: "joined" | "left";
    user: string;
    timestamp: number;
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
export type ChatPayload = ChatMessage | ChatEvent;
export type IncomingMessage = ChatPayload | SignalingMessage;
export type UserMap = Map<string, WebSocket>;
//# sourceMappingURL=types.d.ts.map