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
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=types.js.map