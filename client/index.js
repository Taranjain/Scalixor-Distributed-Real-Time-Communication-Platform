// Real-Time Communication Platform Client
class ChatClient {
    constructor() {
        // Socket & identity
        this.socket = null;
        this.username = "";
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.manualDisconnect = false;

        // WebRTC
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.callTarget = null;
        this.isCaller = false;
        this.micEnabled = true;
        this.cameraEnabled = true;
        this.incomingOffer = null;
        this.incomingCaller = null;

        // ICE servers
        this.iceServers = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        };

        // DOM: Login
        this.loginScreen = document.getElementById("login-screen");
        this.usernameInput = document.getElementById("username");
        this.connectBtn = document.getElementById("connect-btn");

        // DOM: App
        this.app = document.getElementById("app");
        this.usersPanel = document.getElementById("users-panel");
        this.usersList = document.getElementById("users-list");
        this.userCount = document.getElementById("user-count");
        this.toggleSidebar = document.getElementById("toggle-sidebar");
        this.statusDiv = document.getElementById("connection-status");
        this.messagesDiv = document.getElementById("messages");
        this.messageInput = document.getElementById("message");
        this.sendBtn = document.getElementById("send-btn");
        this.leaveBtn = document.getElementById("leave-btn");

        // DOM: Incoming Call Modal
        this.incomingModal = document.getElementById("incoming-call-modal");
        this.callerNameEl = document.getElementById("caller-name");
        this.acceptCallBtn = document.getElementById("accept-call-btn");
        this.rejectCallBtn = document.getElementById("reject-call-btn");

        // DOM: Video Overlay
        this.videoOverlay = document.getElementById("video-overlay");
        this.remoteVideo = document.getElementById("remote-video");
        this.localVideo = document.getElementById("local-video");
        this.callPeerName = document.getElementById("call-peer-name");
        this.toggleMicBtn = document.getElementById("toggle-mic-btn");
        this.toggleCameraBtn = document.getElementById("toggle-camera-btn");
        this.endCallBtn = document.getElementById("end-call-btn");

        this.initEventListeners();
    }

    /* ====================================
       EVENT LISTENERS
    ==================================== */

    initEventListeners() {
        this.connectBtn.addEventListener("click", () => this.connect());
        this.usernameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.connect();
        });

        this.sendBtn.addEventListener("click", () => this.sendMessage());
        this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.sendMessage();
        });

        this.leaveBtn.addEventListener("click", () => this.disconnect());
        this.toggleSidebar.addEventListener("click", () => {
            this.usersPanel.classList.toggle("collapsed");
        });

        // Call controls
        this.acceptCallBtn.addEventListener("click", () => this.acceptCall());
        this.rejectCallBtn.addEventListener("click", () => this.rejectCall());
        this.toggleMicBtn.addEventListener("click", () => this.toggleMic());
        this.toggleCameraBtn.addEventListener("click", () => this.toggleCamera());
        this.endCallBtn.addEventListener("click", () => this.endCall());
    }

    /* ====================================
       STATUS & UI HELPERS
    ==================================== */

    updateStatus(message, isConnected = false) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = isConnected
            ? "status-connected"
            : "status-disconnected";
    }

    showApp() {
        this.loginScreen.style.display = "none";
        this.app.style.display = "flex";
        this.messageInput.focus();
    }

    showLogin() {
        this.app.style.display = "none";
        this.loginScreen.style.display = "flex";
        this.usernameInput.focus();
    }

    addMessage(user, content) {
        const div = document.createElement("div");
        div.className = `message ${user === this.username ? "mine" : "other"}`;

        const sender = document.createElement("div");
        sender.className = "sender";
        sender.textContent = user === this.username ? "You" : user;

        const text = document.createElement("div");
        text.className = "text";
        text.textContent = content;

        div.appendChild(sender);
        div.appendChild(text);
        this.messagesDiv.appendChild(div);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    addSystemMessage(text) {
        const div = document.createElement("div");
        div.className = "message system";
        div.textContent = text;
        this.messagesDiv.appendChild(div);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }

    /* ====================================
       WEBSOCKET CONNECTION
    ==================================== */

    connect() {
        this.username = this.usernameInput.value.trim();
        if (!this.username) {
            alert("Please enter a username");
            this.usernameInput.focus();
            return;
        }

        this.manualDisconnect = false;

        try {
            // Determine WebSocket URL
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws`;
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log("✅ Connected to server");
                this.reconnectAttempts = 0;
                this.updateStatus(`Connected as ${this.username}`, true);
                this.showApp();

                // Notify server
                this.socket.send(
                    JSON.stringify({
                        type: "event",
                        action: "joined",
                        user: this.username,
                    })
                );

                this.addSystemMessage(`✨ You joined the chat`);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error("Error parsing message:", err);
                }
            };

            this.socket.onclose = () => {
                console.log("🔌 Disconnected");
                this.updateStatus("Disconnected", false);

                if (!this.manualDisconnect) {
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        this.addSystemMessage(
                            `🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
                        );
                        setTimeout(() => this.connect(), 2000);
                    } else {
                        this.addSystemMessage("❌ Could not reconnect. Please refresh.");
                        this.showLogin();
                    }
                }
            };

            this.socket.onerror = (err) => {
                console.error("❌ WebSocket error:", err);
                this.updateStatus("Connection error", false);
            };
        } catch (err) {
            console.error("Connection failed:", err);
            alert("Failed to connect. Is the server running?");
        }
    }

    /* ====================================
       MESSAGE ROUTER
    ==================================== */

    handleMessage(data) {
        switch (data.type) {
            case "message":
                this.addMessage(data.user, data.content);
                break;

            case "event":
                if (data.user !== this.username) {
                    const emoji = data.action === "joined" ? "🟢" : "🔴";
                    this.addSystemMessage(`${emoji} ${data.user} ${data.action}`);
                }
                break;

            case "user-list":
                this.updateUserList(data.users);
                break;

            case "offer":
                this.handleOffer(data);
                break;

            case "answer":
                this.handleAnswer(data);
                break;

            case "ice-candidate":
                this.handleIceCandidate(data);
                break;

            case "call-rejected":
                this.handleCallRejected(data);
                break;

            case "call-ended":
                this.handleCallEnded(data);
                break;

            default:
                console.log("Unknown message type:", data.type);
        }
    }

    /* ====================================
       CHAT
    ==================================== */

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            alert("Not connected to server");
            return;
        }

        this.socket.send(
            JSON.stringify({
                type: "message",
                user: this.username,
                content: content,
            })
        );

        this.messageInput.value = "";
        this.messageInput.focus();
    }

    disconnect() {
        this.manualDisconnect = true;

        if (this.peerConnection) {
            this.endCall();
        }

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(
                JSON.stringify({
                    type: "event",
                    action: "left",
                    user: this.username,
                })
            );
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.addSystemMessage(`👋 You left the chat`);
        this.showLogin();
    }

    /* ====================================
       ONLINE USERS LIST
    ==================================== */

    updateUserList(users) {
        this.usersList.innerHTML = "";
        this.userCount.textContent = users.length;

        users.forEach((user) => {
            const li = document.createElement("li");

            const info = document.createElement("div");
            info.className = "user-info";

            const dot = document.createElement("span");
            dot.className = "user-dot";

            const name = document.createElement("span");
            name.textContent = user;

            info.appendChild(dot);
            info.appendChild(name);

            if (user === this.username) {
                const youTag = document.createElement("span");
                youTag.className = "user-you";
                youTag.textContent = "(you)";
                info.appendChild(youTag);
            }

            li.appendChild(info);

            // Call button (not for self)
            if (user !== this.username) {
                const callBtn = document.createElement("button");
                callBtn.className = "call-user-btn";
                callBtn.textContent = "📹 Call";
                callBtn.addEventListener("click", () => this.startCall(user));
                li.appendChild(callBtn);
            }

            this.usersList.appendChild(li);
        });
    }

    /* ====================================
       WEBRTC — START CALL (CALLER)
    ==================================== */

    async startCall(targetUser) {
        if (this.peerConnection) {
            alert("You are already in a call.");
            return;
        }

        this.callTarget = targetUser;
        this.isCaller = true;

        try {
            // Get local media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.localVideo.srcObject = this.localStream;

            // Create peer connection
            this.createPeerConnection();

            // Add local tracks
            this.localStream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.socket.send(
                JSON.stringify({
                    type: "offer",
                    from: this.username,
                    to: targetUser,
                    sdp: offer,
                })
            );

            // Show video UI
            this.callPeerName.textContent = `Calling ${targetUser}...`;
            this.videoOverlay.style.display = "flex";
            this.resetCallControls();

            console.log(`📞 Calling ${targetUser}...`);
        } catch (err) {
            console.error("Failed to start call:", err);
            alert("Could not access camera/microphone. Please grant permissions.");
            this.cleanupCall();
        }
    }

    /* ====================================
       WEBRTC — HANDLE INCOMING OFFER
    ==================================== */

    handleOffer(data) {
        if (data.to !== this.username) return;

        // If already in a call, auto-reject
        if (this.peerConnection) {
            this.socket.send(
                JSON.stringify({
                    type: "call-rejected",
                    from: this.username,
                    to: data.from,
                })
            );
            return;
        }

        // Store incoming offer and show modal
        this.incomingOffer = data;
        this.incomingCaller = data.from;
        this.callerNameEl.textContent = `${data.from} is calling you...`;
        this.incomingModal.style.display = "flex";
    }

    /* ====================================
       WEBRTC — ACCEPT CALL
    ==================================== */

    async acceptCall() {
        this.incomingModal.style.display = "none";

        if (!this.incomingOffer) return;

        this.callTarget = this.incomingCaller;
        this.isCaller = false;

        try {
            // Get local media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.localVideo.srcObject = this.localStream;

            // Create peer connection
            this.createPeerConnection();

            // Add local tracks
            this.localStream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Set remote description (the offer)
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(this.incomingOffer.sdp)
            );

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.send(
                JSON.stringify({
                    type: "answer",
                    from: this.username,
                    to: this.incomingCaller,
                    sdp: answer,
                })
            );

            // Show video UI
            this.callPeerName.textContent = `In call with ${this.callTarget}`;
            this.videoOverlay.style.display = "flex";
            this.resetCallControls();

            console.log(`📞 Accepted call from ${this.incomingCaller}`);
        } catch (err) {
            console.error("Failed to accept call:", err);
            alert("Could not access camera/microphone.");
            this.cleanupCall();
        }

        this.incomingOffer = null;
        this.incomingCaller = null;
    }

    /* ====================================
       WEBRTC — REJECT CALL
    ==================================== */

    rejectCall() {
        this.incomingModal.style.display = "none";

        if (this.incomingCaller) {
            this.socket.send(
                JSON.stringify({
                    type: "call-rejected",
                    from: this.username,
                    to: this.incomingCaller,
                })
            );
        }

        this.incomingOffer = null;
        this.incomingCaller = null;
    }

    /* ====================================
       WEBRTC — HANDLE ANSWER
    ==================================== */

    async handleAnswer(data) {
        if (data.to !== this.username) return;
        if (!this.peerConnection) return;

        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.sdp)
            );
            this.callPeerName.textContent = `In call with ${data.from}`;
            console.log(`📞 Call connected with ${data.from}`);
        } catch (err) {
            console.error("Failed to set remote description:", err);
        }
    }

    /* ====================================
       WEBRTC — ICE CANDIDATE
    ==================================== */

    async handleIceCandidate(data) {
        if (data.to !== this.username) return;
        if (!this.peerConnection) return;

        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );
        } catch (err) {
            console.error("Failed to add ICE candidate:", err);
        }
    }

    /* ====================================
       WEBRTC — CALL REJECTED / ENDED
    ==================================== */

    handleCallRejected(data) {
        if (data.to !== this.username) return;
        alert(`${data.from} rejected your call.`);
        this.cleanupCall();
    }

    handleCallEnded(data) {
        if (data.to !== this.username) return;
        this.addSystemMessage(`📵 Call with ${data.from} ended`);
        this.cleanupCall();
    }

    /* ====================================
       WEBRTC — PEER CONNECTION
    ==================================== */

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.iceServers);

        // ICE candidate handler
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "ice-candidate",
                        from: this.username,
                        to: this.callTarget,
                        candidate: event.candidate,
                    })
                );
            }
        };

        // Remote stream handler
        this.peerConnection.ontrack = (event) => {
            this.remoteVideo.srcObject = event.streams[0];
        };

        // Connection state monitoring
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection?.iceConnectionState;
            console.log(`🔗 ICE Connection State: ${state}`);

            if (state === "disconnected" || state === "failed" || state === "closed") {
                this.addSystemMessage(`📵 Call disconnected`);
                this.cleanupCall();
            }
        };
    }

    /* ====================================
       WEBRTC — END CALL
    ==================================== */

    endCall() {
        // Notify the other peer
        if (this.socket && this.callTarget) {
            this.socket.send(
                JSON.stringify({
                    type: "call-ended",
                    from: this.username,
                    to: this.callTarget,
                })
            );
        }

        this.addSystemMessage(`📵 Call ended`);
        this.cleanupCall();
    }

    cleanupCall() {
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Stop local media tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        // Clear video elements
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;

        // Hide UI
        this.videoOverlay.style.display = "none";
        this.incomingModal.style.display = "none";

        // Reset state
        this.callTarget = null;
        this.isCaller = false;
        this.micEnabled = true;
        this.cameraEnabled = true;
        this.incomingOffer = null;
        this.incomingCaller = null;
    }

    /* ====================================
       CALL CONTROLS
    ==================================== */

    toggleMic() {
        if (!this.localStream) return;
        this.micEnabled = !this.micEnabled;
        this.localStream.getAudioTracks().forEach((track) => {
            track.enabled = this.micEnabled;
        });
        this.toggleMicBtn.textContent = this.micEnabled ? "🎤" : "🔇";
        this.toggleMicBtn.className = `control-btn ${this.micEnabled ? "active" : "muted"}`;
    }

    toggleCamera() {
        if (!this.localStream) return;
        this.cameraEnabled = !this.cameraEnabled;
        this.localStream.getVideoTracks().forEach((track) => {
            track.enabled = this.cameraEnabled;
        });
        this.toggleCameraBtn.textContent = this.cameraEnabled ? "📷" : "🚫";
        this.toggleCameraBtn.className = `control-btn ${this.cameraEnabled ? "active" : "muted"}`;
    }

    resetCallControls() {
        this.micEnabled = true;
        this.cameraEnabled = true;
        this.toggleMicBtn.textContent = "🎤";
        this.toggleMicBtn.className = "control-btn active";
        this.toggleCameraBtn.textContent = "📷";
        this.toggleCameraBtn.className = "control-btn active";
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    new ChatClient();
});