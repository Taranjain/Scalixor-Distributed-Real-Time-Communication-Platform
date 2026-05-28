"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
/* ================================
   MESSAGE TYPES
================================ */
var MessageType;
(function (MessageType) {
    MessageType["Message"] = "message";
    MessageType["Event"] = "event";
    MessageType["Offer"] = "offer";
    MessageType["Answer"] = "answer";
    MessageType["IceCandidate"] = "ice-candidate";
    MessageType["UserList"] = "user-list";
    MessageType["CallRejected"] = "call-rejected";
    MessageType["CallEnded"] = "call-ended";
    MessageType["RoomMessage"] = "room-message";
    MessageType["JoinRoom"] = "join-room";
    MessageType["LeaveRoom"] = "leave-room";
    MessageType["RoomUserList"] = "room-user-list";
    MessageType["CodeUpdate"] = "code-update";
    MessageType["CodeLanguageChange"] = "code-language-change";
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=types.js.map