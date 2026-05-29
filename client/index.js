// ═══════════════════════════════════════════════════════
//  Scalixor — Full Client
// ═══════════════════════════════════════════════════════

const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

/* ============================================================
   THEME MANAGER
   ============================================================ */
class ThemeManager {
    constructor() {
        this.key = "scalixor-theme";
        this.init();
    }

    init() {
        const saved = localStorage.getItem(this.key);
        if (saved === "light" || saved === "dark") {
            this.set(saved);
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            this.set(prefersDark ? "dark" : "light");
        }
    }

    toggle() {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "light" ? "dark" : "light";
        this.set(next);
    }

    set(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem(this.key, theme);
    }
}

/* ============================================================
   ICON HELPER
   ============================================================ */
function createIcon(name, size = 16) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.flexShrink = "0";
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#icon-${name}`);
    svg.appendChild(use);
    return svg;
}

/* ============================================================
   CHAT CLIENT
   ============================================================ */
class ChatClient {
    constructor() {
        this.theme = new ThemeManager();

        // Auth
        this.token = localStorage.getItem("token") || "";
        this.username = localStorage.getItem("username") || "";
        this.userId = localStorage.getItem("userId") || "";

        // Socket
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.manualDisconnect = false;

        // Rooms
        this.currentRoomId = null;
        this.rooms = [];

        // Code Editor
        this.codeEditorInstance = null;
        this.codePanelVisible = false;
        this.editorBundleLoaded = false;
        this.codeAutosaveInterval = null;

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
        this.pendingIceCandidates = [];

        this.iceServers = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        };

        this.cacheDOMElements();
        this.initEventListeners();

        // Auto-login if token exists
        if (this.token) {
            this.showApp();
            this.connectWebSocket();
            this.loadRooms();
            this.loadFriends();
            this.loadCallHistory();
        } else {
            this.showLanding();
        }
    }

    /* ====================================
       DOM CACHING
    ==================================== */

    cacheDOMElements() {
        // Landing
        this.landingPage = document.getElementById("landing-page");
        this.landingLoginBtn = document.getElementById("landing-login-btn");
        this.heroCtaBtn = document.getElementById("hero-cta-btn");
        this.navHamburger = document.getElementById("nav-hamburger");
        this.navLinks = document.getElementById("landing-nav-links");

        // Theme
        this.themeToggle = document.getElementById("theme-toggle");

        // Auth
        this.authScreen = document.getElementById("auth-screen");
        this.authCard = document.getElementById("auth-card");
        this.authBackBtn = document.getElementById("auth-back-btn");
        this.tabLogin = document.getElementById("tab-login");
        this.tabSignup = document.getElementById("tab-signup");
        this.loginForm = document.getElementById("login-form");
        this.signupForm = document.getElementById("signup-form");
        this.loginUsername = document.getElementById("login-username");
        this.loginPassword = document.getElementById("login-password");
        this.loginBtn = document.getElementById("login-btn");
        this.signupUsername = document.getElementById("signup-username");
        this.signupEmail = document.getElementById("signup-email");
        this.signupPassword = document.getElementById("signup-password");
        this.signupBtn = document.getElementById("signup-btn");
        this.authError = document.getElementById("auth-error");

        // App
        this.app = document.getElementById("app");
        this.sidebar = document.getElementById("sidebar");
        this.sidebarUsername = document.getElementById("sidebar-username");
        this.sidebarAvatar = document.getElementById("sidebar-avatar");
        this.logoutBtn = document.getElementById("logout-btn");

        // Sidebar tabs
        this.sidebarTabs = document.querySelectorAll(".sidebar-tab");
        this.roomsTab = document.getElementById("rooms-tab");
        this.friendsTab = document.getElementById("friends-tab");
        this.callsTab = document.getElementById("calls-tab");

        // Rooms
        this.createRoomBtn = document.getElementById("create-room-btn");
        this.joinRoomBtn = document.getElementById("join-room-btn");
        this.roomsList = document.getElementById("rooms-list");

        // Friends
        this.addFriendBtn = document.getElementById("add-friend-btn");
        this.pendingRequestsList = document.getElementById("pending-requests-list");
        this.friendsList = document.getElementById("friends-list");

        // Calls
        this.callsList = document.getElementById("calls-list");

        // Online Users
        this.usersList = document.getElementById("users-list");
        this.userCount = document.getElementById("user-count");

        // Chat
        this.chatRoomTitle = document.getElementById("chat-room-title");
        this.roomIdDisplay = document.getElementById("room-id-display");
        this.toggleSidebarBtn = document.getElementById("toggle-sidebar");
        this.statusDiv = document.getElementById("connection-status");
        this.welcomeScreen = document.getElementById("welcome-screen");
        this.chatPanels = document.getElementById("chat-panels");
        this.chatLeftPanel = document.getElementById("chat-left-panel");
        this.messagesDiv = document.getElementById("messages");
        this.inputArea = document.getElementById("input-area");
        this.messageInput = document.getElementById("message");
        this.sendBtn = document.getElementById("send-btn");

        // Code Editor
        this.toggleCodeBtn = document.getElementById("toggle-code-btn");
        this.codeRightPanel = document.getElementById("code-right-panel");
        this.codeLangSelect = document.getElementById("code-lang-select");
        this.codeEditorContainer = document.getElementById("code-editor-container");

        // Modals
        this.createRoomModal = document.getElementById("create-room-modal");
        this.newRoomName = document.getElementById("new-room-name");
        this.createRoomConfirm = document.getElementById("create-room-confirm");
        this.createRoomCancel = document.getElementById("create-room-cancel");

        this.joinRoomModal = document.getElementById("join-room-modal");
        this.joinRoomId = document.getElementById("join-room-id");
        this.joinRoomConfirm = document.getElementById("join-room-confirm");
        this.joinRoomCancel = document.getElementById("join-room-cancel");

        this.addFriendModal = document.getElementById("add-friend-modal");
        this.friendUsernameInput = document.getElementById("friend-username-input");
        this.addFriendConfirm = document.getElementById("add-friend-confirm");
        this.addFriendCancel = document.getElementById("add-friend-cancel");

        // Incoming Call
        this.incomingModal = document.getElementById("incoming-call-modal");
        this.callerNameEl = document.getElementById("caller-name");
        this.acceptCallBtn = document.getElementById("accept-call-btn");
        this.rejectCallBtn = document.getElementById("reject-call-btn");

        // Video
        this.videoOverlay = document.getElementById("video-overlay");
        this.remoteVideo = document.getElementById("remote-video");
        this.localVideo = document.getElementById("local-video");
        this.callPeerName = document.getElementById("call-peer-name");
        this.toggleMicBtn = document.getElementById("toggle-mic-btn");
        this.toggleCameraBtn = document.getElementById("toggle-camera-btn");
        this.endCallBtn = document.getElementById("end-call-btn");
    }

    /* ====================================
       EVENT LISTENERS
    ==================================== */

    initEventListeners() {
        // Theme toggle
        this.themeToggle.addEventListener("click", () => this.theme.toggle());

        // Landing page
        this.landingLoginBtn.addEventListener("click", () => this.showAuth());
        this.heroCtaBtn.addEventListener("click", () => this.showAuth());
        this.authBackBtn.addEventListener("click", () => this.showLanding());

        // Nav hamburger toggle
        this.navHamburger.addEventListener("click", (e) => {
            e.stopPropagation();
            this.navLinks.classList.toggle("is-open");
            const expanded = this.navLinks.classList.contains("is-open");
            this.navHamburger.setAttribute("aria-expanded", String(expanded));
        });

        // Close nav on click outside
        document.addEventListener("click", (e) => {
            if (
                this.navLinks.classList.contains("is-open") &&
                !this.navLinks.contains(e.target) &&
                !this.navHamburger.contains(e.target)
            ) {
                this.navLinks.classList.remove("is-open");
                this.navHamburger.setAttribute("aria-expanded", "false");
            }
        });

        // Nav anchor smooth scroll
        document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
            link.addEventListener("click", (e) => {
                const href = link.getAttribute("href");
                if (href && href.startsWith("#")) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        this.navLinks.classList.remove("is-open");
                        this.navHamburger.setAttribute("aria-expanded", "false");
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                }
            });
        });

        // Auth tabs
        this.tabLogin.addEventListener("click", () => this.switchAuthTab("login"));
        this.tabSignup.addEventListener("click", () => this.switchAuthTab("signup"));

        // Auth forms
        this.loginBtn.addEventListener("click", () => this.login());
        this.signupBtn.addEventListener("click", () => this.signup());
        this.loginPassword.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.login();
        });
        this.signupPassword.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.signup();
        });

        // Logout
        this.logoutBtn.addEventListener("click", () => this.logout());

        // Sidebar tabs
        this.sidebarTabs.forEach((tab) => {
            tab.addEventListener("click", () => this.switchSidebarTab(tab.dataset.tab));
        });

        // Toggle sidebar
        this.toggleSidebarBtn.addEventListener("click", () => {
            this.sidebar.classList.toggle("collapsed");
        });

        // Chat
        this.sendBtn.addEventListener("click", () => this.sendMessage());
        this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.sendMessage();
        });

        // Room modals
        this.createRoomBtn.addEventListener("click", () => this.showModal(this.createRoomModal));
        this.createRoomConfirm.addEventListener("click", () => this.createRoom());
        this.createRoomCancel.addEventListener("click", () => this.hideModal(this.createRoomModal));
        this.newRoomName.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.createRoom();
        });

        this.joinRoomBtn.addEventListener("click", () => this.showModal(this.joinRoomModal));
        this.joinRoomConfirm.addEventListener("click", () => this.joinRoomById());
        this.joinRoomCancel.addEventListener("click", () => this.hideModal(this.joinRoomModal));
        this.joinRoomId.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.joinRoomById();
        });

        // Friends modal
        this.addFriendBtn.addEventListener("click", () => this.showModal(this.addFriendModal));
        this.addFriendConfirm.addEventListener("click", () => this.sendFriendRequest());
        this.addFriendCancel.addEventListener("click", () => this.hideModal(this.addFriendModal));
        this.friendUsernameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.sendFriendRequest();
        });

        // Room ID copy
        this.roomIdDisplay.addEventListener("click", () => {
            if (this.currentRoomId) {
                navigator.clipboard.writeText(this.currentRoomId);
                this.roomIdDisplay.textContent = "Copied!";
                setTimeout(() => {
                    this.roomIdDisplay.textContent = this.currentRoomId.substring(0, 8) + "...";
                }, 1500);
            }
        });

        // Call controls
        this.acceptCallBtn.addEventListener("click", () => this.acceptCall());
        this.rejectCallBtn.addEventListener("click", () => this.rejectCall());
        this.toggleMicBtn.addEventListener("click", () => this.toggleMic());
        this.toggleCameraBtn.addEventListener("click", () => this.toggleCamera());
        this.endCallBtn.addEventListener("click", () => this.endCall());

        // Code editor toggle
        this.toggleCodeBtn.addEventListener("click", () => this.toggleCodeEditor());

        // Code language change
        this.codeLangSelect.addEventListener("change", () => this.onCodeLanguageChange());
    }

    /* ====================================
       NAVIGATION
    ==================================== */

    showLanding() {
        this.landingPage.style.display = "block";
        this.authScreen.classList.remove("active");
        this.app.classList.remove("active");
    }

    showAuth() {
        this.landingPage.style.display = "none";
        this.authScreen.classList.add("active");
        this.app.classList.remove("active");
    }

    showApp() {
        this.landingPage.style.display = "none";
        this.authScreen.classList.remove("active");
        this.app.classList.add("active");
        this.sidebarUsername.textContent = this.username;
        this.sidebarAvatar.textContent = this.username.charAt(0).toUpperCase();
    }

    /* ====================================
       AUTH
    ==================================== */

    switchAuthTab(tab) {
        this.authError.textContent = "";
        if (tab === "login") {
            this.tabLogin.classList.add("active");
            this.tabSignup.classList.remove("active");
            this.loginForm.style.display = "flex";
            this.signupForm.style.display = "none";
        } else {
            this.tabSignup.classList.add("active");
            this.tabLogin.classList.remove("active");
            this.signupForm.style.display = "flex";
            this.loginForm.style.display = "none";
        }
    }

    async login() {
        const username = this.loginUsername.value.trim();
        const password = this.loginPassword.value;

        if (!username || !password) {
            this.authError.textContent = "Please fill in all fields";
            return;
        }

        this.loginBtn.disabled = true;
        this.loginBtn.textContent = "Logging in...";

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                this.authError.textContent = data.error || "Login failed";
                return;
            }

            this.token = data.token;
            this.username = data.user.username;
            this.userId = data.user.id;
            localStorage.setItem("token", this.token);
            localStorage.setItem("username", this.username);
            localStorage.setItem("userId", this.userId);

            this.showApp();
            this.connectWebSocket();
            this.loadRooms();
            this.loadFriends();
            this.loadCallHistory();
        } catch (err) {
            this.authError.textContent = "Connection error. Is the server running?";
            console.error(err);
        } finally {
            this.loginBtn.disabled = false;
            this.loginBtn.textContent = "Login";
        }
    }

    async signup() {
        const username = this.signupUsername.value.trim();
        const email = this.signupEmail.value.trim();
        const password = this.signupPassword.value;

        if (!username || !email || !password) {
            this.authError.textContent = "Please fill in all fields";
            return;
        }

        this.signupBtn.disabled = true;
        this.signupBtn.textContent = "Creating account...";

        try {
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                this.authError.textContent = data.error || "Signup failed";
                return;
            }

            this.token = data.token;
            this.username = data.user.username;
            this.userId = data.user.id;
            localStorage.setItem("token", this.token);
            localStorage.setItem("username", this.username);
            localStorage.setItem("userId", this.userId);

            this.showApp();
            this.connectWebSocket();
            this.loadRooms();
            this.loadFriends();
            this.loadCallHistory();
        } catch (err) {
            this.authError.textContent = "Connection error. Is the server running?";
            console.error(err);
        } finally {
            this.signupBtn.disabled = false;
            this.signupBtn.textContent = "Create Account";
        }
    }

    logout() {
        this.manualDisconnect = true;
        if (this.peerConnection) this.endCall();
        this.destroyCodeEditor();
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "event", action: "left", user: this.username,
            }));
            this.socket.close();
        }

        this.token = "";
        this.username = "";
        this.userId = "";
        this.currentRoomId = null;
        this.rooms = [];
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("userId");

        this.showLanding();
    }

    /* ====================================
       UI HELPERS
    ==================================== */

    showModal(modal) {
        modal.classList.add("active");
        const input = modal.querySelector("input");
        if (input) { input.value = ""; input.focus(); }
    }

    hideModal(modal) {
        modal.classList.remove("active");
    }

    updateStatus(message, isConnected = false) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = isConnected ? "status-connected" : "status-disconnected";
    }

    switchSidebarTab(tab) {
        this.sidebarTabs.forEach((t) => {
            t.classList.toggle("active", t.dataset.tab === tab);
        });
        this.roomsTab.style.display = "none";
        this.friendsTab.style.display = "none";
        this.callsTab.style.display = "none";
        if (tab === "rooms") this.roomsTab.style.display = "flex";
        if (tab === "friends") this.friendsTab.style.display = "flex";
        if (tab === "calls") { this.callsTab.style.display = "flex"; this.loadCallHistory(); }
    }

    /* ====================================
       CODE EDITOR
    ==================================== */

    async toggleCodeEditor() {
        if (!this.currentRoomId) return;

        this.codePanelVisible = !this.codePanelVisible;

        if (this.codePanelVisible) {
            this.codeRightPanel.classList.add("visible");
            this.chatPanels.classList.add("editor-open");
            this.toggleCodeBtn.classList.add("active");

            if (!this.codeEditorInstance) {
                await this.initCodeEditor();
            }
        } else {
            this.codeRightPanel.classList.remove("visible");
            this.chatPanels.classList.remove("editor-open");
            this.toggleCodeBtn.classList.remove("active");
        }
    }

    async initCodeEditor() {
        if (!window.CodeEditor) {
            console.warn("CodeEditor bundle not loaded yet");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/rooms/${this.currentRoomId}/code`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });

            let initialContent = "";
            let language = "javascript";

            if (res.ok) {
                const data = await res.json();
                initialContent = data.content || "";
                language = data.language || "javascript";
            }

            this.codeLangSelect.value = language;

            this.codeEditorInstance = window.CodeEditor.init({
                container: this.codeEditorContainer,
                roomId: this.currentRoomId,
                ws: this.socket,
                initialContent,
                language,
                username: this.username,
            });

            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: "code-sync-request",
                    roomId: this.currentRoomId,
                    user: this.username,
                }));
            }

            this.startCodeAutosave();
        } catch (err) {
            console.error("Init code editor error:", err);
        }
    }

    destroyCodeEditor() {
        if (this.codeAutosaveInterval) {
            clearInterval(this.codeAutosaveInterval);
            this.codeAutosaveInterval = null;
        }
        if (this.codeEditorInstance) {
            this.codeEditorInstance.destroy();
            this.codeEditorInstance = null;
        }
        this.codePanelVisible = false;
        this.codeRightPanel.classList.remove("visible");
        this.chatPanels.classList.remove("editor-open");
        this.toggleCodeBtn.classList.remove("active");
    }

    startCodeAutosave() {
        if (this.codeAutosaveInterval) {
            clearInterval(this.codeAutosaveInterval);
        }
        this.codeAutosaveInterval = setInterval(() => {
            if (!this.codeEditorInstance || !this.currentRoomId) return;
            this.saveCodeSession();
        }, 5000);
    }

    async saveCodeSession() {
        if (!this.codeEditorInstance || !this.currentRoomId) return;
        try {
            const content = this.codeEditorInstance.getContent();
            const language = this.codeLangSelect.value;
            await fetch(`${API_BASE}/rooms/${this.currentRoomId}/code`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ content, language }),
            });
        } catch (err) {
            console.error("Autosave error:", err);
        }
    }

    async onCodeLanguageChange() {
        if (!this.codeEditorInstance) return;
        const language = this.codeLangSelect.value;
        this.codeEditorInstance.setLanguage(language);

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "code-language-change",
                roomId: this.currentRoomId,
                language,
                user: this.username,
            }));
        }

        await this.saveCodeSession();
    }

    addMessage(user, content, timestamp) {
        const div = document.createElement("div");
        div.className = `message ${user === this.username ? "mine" : "other"}`;

        const sender = document.createElement("div");
        sender.className = "sender";
        sender.textContent = user === this.username ? "You" : user;

        const text = document.createElement("div");
        text.className = "text";
        text.textContent = content;

        const time = document.createElement("div");
        time.className = "timestamp";
        time.textContent = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

        div.appendChild(sender);
        div.appendChild(text);
        div.appendChild(time);
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

    connectWebSocket() {
        this.manualDisconnect = false;

        try {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws`;
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log("Connected to server");
                this.reconnectAttempts = 0;
                this.updateStatus("Connected", true);

                this.socket.send(JSON.stringify({
                    type: "event",
                    action: "joined",
                    user: this.username,
                    token: this.token,
                }));

                if (this.currentRoomId) {
                    this.socket.send(JSON.stringify({
                        type: "join-room",
                        roomId: this.currentRoomId,
                        user: this.username,
                    }));
                }
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
                console.log("Disconnected");
                this.updateStatus("Disconnected", false);

                if (!this.manualDisconnect) {
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        setTimeout(() => this.connectWebSocket(), 2000);
                    }
                }
            };

            this.socket.onerror = (err) => {
                console.error("WebSocket error:", err);
                this.updateStatus("Connection error", false);
            };
        } catch (err) {
            console.error("Connection failed:", err);
        }
    }

    /* ====================================
       MESSAGE ROUTER
    ==================================== */

    handleMessage(data) {
        switch (data.type) {
            case "message":
                if (data.roomId === this.currentRoomId) {
                    this.addMessage(data.user, data.content, data.timestamp);
                }
                break;

            case "event":
                if (data.user !== this.username) {
                    const status = data.action === "joined" ? "joined" : "left";
                    if (this.currentRoomId) {
                        this.addSystemMessage(`${data.user} ${status}`);
                    }
                }
                break;

            case "user-list":
                this.updateUserList(data.users);
                break;

            case "join-room":
                if (data.success) {
                    console.log(`Joined room ${data.roomId}`);
                }
                break;

            case "error":
                console.error("Server error:", data.error);
                if (data.error === "Invalid token") {
                    this.logout();
                }
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

            case "code-update":
                if (data.roomId === this.currentRoomId && data.user !== this.username) {
                    if (this.codeEditorInstance) {
                        this.codeEditorInstance.applyUpdate(data.update);
                    }
                }
                break;

            case "code-language-change":
                if (data.roomId === this.currentRoomId && data.user !== this.username) {
                    this.codeLangSelect.value = data.language;
                    if (this.codeEditorInstance) {
                        this.codeEditorInstance.setLanguage(data.language);
                    }
                }
                break;

            case "code-sync-request":
                if (data.roomId === this.currentRoomId && data.user !== this.username) {
                    if (this.codeEditorInstance) {
                        const stateUpdate = this.codeEditorInstance.getStateUpdate();
                        this.socket.send(JSON.stringify({
                            type: "code-sync-response",
                            roomId: this.currentRoomId,
                            update: stateUpdate,
                            user: this.username,
                        }));
                    }
                }
                break;

            case "code-sync-response":
                if (data.roomId === this.currentRoomId && data.user !== this.username) {
                    if (this.codeEditorInstance) {
                        this.codeEditorInstance.applyUpdate(data.update);
                    }
                }
                break;

            default:
                console.log("Unknown message type:", data.type);
        }
    }

    /* ====================================
       ROOMS
    ==================================== */

    async loadRooms() {
        try {
            const res = await fetch(`${API_BASE}/rooms`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!res.ok) return;
            this.rooms = await res.json();
            this.renderRoomsList();
        } catch (err) {
            console.error("Load rooms error:", err);
        }
    }

    renderRoomsList() {
        this.roomsList.innerHTML = "";
        this.rooms.forEach((room) => {
            const li = document.createElement("li");
            li.className = `room-item ${room.id === this.currentRoomId ? "active" : ""}`;
            li.addEventListener("click", () => this.switchRoom(room));

            const iconWrap = document.createElement("span");
            iconWrap.className = "room-icon";
            const iconSvg = createIcon(room.isGroup ? "message" : "user", 18);
            iconWrap.appendChild(iconSvg);

            const info = document.createElement("div");
            info.className = "room-info";

            const name = document.createElement("div");
            name.className = "room-name";
            name.textContent = room.isGroup ? room.name : this.getDMPartnerName(room);

            const meta = document.createElement("div");
            meta.className = "room-meta";
            meta.textContent = `${room.members?.length || 0} members`;

            info.appendChild(name);
            info.appendChild(meta);

            li.appendChild(iconWrap);
            li.appendChild(info);
            this.roomsList.appendChild(li);
        });
    }

    getDMPartnerName(room) {
        if (!room.members) return room.name;
        const partner = room.members.find(m => m.user.username !== this.username);
        return partner ? partner.user.username : room.name;
    }

    async switchRoom(room) {
        this.currentRoomId = room.id;

        const prefix = room.isGroup ? "" : "";
        this.chatRoomTitle.textContent = prefix + (room.isGroup ? room.name : this.getDMPartnerName(room));
        this.roomIdDisplay.textContent = room.id.substring(0, 8) + "...";
        this.roomIdDisplay.title = `Room ID: ${room.id} (click to copy)`;
        this.welcomeScreen.style.display = "none";
        this.chatPanels.style.display = "flex";
        this.messagesDiv.style.display = "flex";
        this.inputArea.style.display = "flex";
        this.messagesDiv.innerHTML = "";
        this.toggleCodeBtn.style.display = "flex";

        this.renderRoomsList();

        if (this.codeEditorInstance) {
            this.destroyCodeEditor();
        }

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "join-room",
                roomId: room.id,
                user: this.username,
            }));
        }

        await this.loadChatHistory(room.id);
        this.messageInput.focus();
    }

    async loadChatHistory(roomId) {
        try {
            const res = await fetch(`${API_BASE}/rooms/${roomId}/messages`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            data.messages.forEach((msg) => {
                this.addMessage(msg.sender.username, msg.content, new Date(msg.createdAt).getTime());
            });
        } catch (err) {
            console.error("Load history error:", err);
        }
    }

    async createRoom() {
        const name = this.newRoomName.value.trim();
        if (!name) return;

        try {
            const res = await fetch(`${API_BASE}/rooms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.error || "Failed to create room");
                return;
            }

            const room = await res.json();
            this.hideModal(this.createRoomModal);
            await this.loadRooms();
            this.switchRoom(room);
        } catch (err) {
            console.error("Create room error:", err);
        }
    }

    async joinRoomById() {
        const roomId = this.joinRoomId.value.trim();
        if (!roomId) return;

        try {
            const res = await fetch(`${API_BASE}/rooms/join`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ roomId }),
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.error || "Failed to join room");
                return;
            }

            const room = await res.json();
            this.hideModal(this.joinRoomModal);
            await this.loadRooms();
            this.switchRoom(room);
        } catch (err) {
            console.error("Join room error:", err);
        }
    }

    /* ====================================
       CHAT
    ==================================== */

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;
        if (!this.currentRoomId) {
            alert("Please select a room first");
            return;
        }
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            alert("Not connected to server");
            return;
        }

        this.socket.send(JSON.stringify({
            type: "message",
            user: this.username,
            content: content,
            roomId: this.currentRoomId,
        }));

        this.messageInput.value = "";
        this.messageInput.focus();
    }

    /* ====================================
       DM
    ==================================== */

    async startDM(targetUsername) {
        try {
            const res = await fetch(`${API_BASE}/dm`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ targetUsername }),
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.error || "Failed to create DM");
                return;
            }

            const room = await res.json();
            await this.loadRooms();
            this.switchRoom(room);
            this.switchSidebarTab("rooms");
        } catch (err) {
            console.error("DM error:", err);
        }
    }

    /* ====================================
       FRIENDS
    ==================================== */

    async loadFriends() {
        try {
            const res = await fetch(`${API_BASE}/friends`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!res.ok) return;
            const friends = await res.json();
            this.renderFriendsList(friends);
        } catch (err) {
            console.error("Load friends error:", err);
        }
    }

    renderFriendsList(friends) {
        this.pendingRequestsList.innerHTML = "";
        this.friendsList.innerHTML = "";

        const pending = friends.filter(f => f.status === "PENDING");
        const accepted = friends.filter(f => f.status === "ACCEPTED");

        pending.forEach((f) => {
            const li = document.createElement("li");
            li.className = "friend-item";

            const info = document.createElement("div");
            info.className = "friend-info";

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = f.friend.username;

            const label = document.createElement("span");
            label.className = "friend-label";
            label.textContent = f.isSender ? "Sent" : "Received";

            info.appendChild(name);
            info.appendChild(label);
            li.appendChild(info);

            if (!f.isSender) {
                const actions = document.createElement("div");
                actions.className = "friend-actions";

                const acceptBtn = document.createElement("button");
                acceptBtn.className = "friend-action-btn success";
                acceptBtn.title = "Accept";
                acceptBtn.appendChild(createIcon("check", 14));
                acceptBtn.addEventListener("click", () => this.acceptFriend(f.id));

                const rejectBtn = document.createElement("button");
                rejectBtn.className = "friend-action-btn danger";
                rejectBtn.title = "Reject";
                rejectBtn.appendChild(createIcon("x", 14));
                rejectBtn.addEventListener("click", () => this.removeFriend(f.id));

                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);
                li.appendChild(actions);
            }

            this.pendingRequestsList.appendChild(li);
        });

        if (pending.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.textContent = "No pending requests";
            this.pendingRequestsList.appendChild(empty);
        }

        accepted.forEach((f) => {
            const li = document.createElement("li");
            li.className = "friend-item";

            const info = document.createElement("div");
            info.className = "friend-info";

            const dot = document.createElement("span");
            dot.className = "user-dot";

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = f.friend.username;

            info.appendChild(dot);
            info.appendChild(name);
            li.appendChild(info);

            const actions = document.createElement("div");
            actions.className = "friend-actions";

            const dmBtn = document.createElement("button");
            dmBtn.className = "friend-action-btn";
            dmBtn.title = "Send DM";
            dmBtn.appendChild(createIcon("message", 14));
            dmBtn.addEventListener("click", () => this.startDM(f.friend.username));

            const callBtn = document.createElement("button");
            callBtn.className = "friend-action-btn";
            callBtn.title = "Video Call";
            callBtn.appendChild(createIcon("video", 14));
            callBtn.addEventListener("click", () => this.startCall(f.friend.username));

            const removeBtn = document.createElement("button");
            removeBtn.className = "friend-action-btn danger";
            removeBtn.title = "Remove";
            removeBtn.appendChild(createIcon("trash", 14));
            removeBtn.addEventListener("click", () => this.removeFriend(f.id));

            actions.appendChild(dmBtn);
            actions.appendChild(callBtn);
            actions.appendChild(removeBtn);
            li.appendChild(actions);
            this.friendsList.appendChild(li);
        });

        if (accepted.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.textContent = "No friends yet. Add someone!";
            this.friendsList.appendChild(empty);
        }
    }

    async sendFriendRequest() {
        const username = this.friendUsernameInput.value.trim();
        if (!username) return;

        try {
            const res = await fetch(`${API_BASE}/friends/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify({ targetUsername: username }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to send friend request");
                return;
            }

            this.hideModal(this.addFriendModal);
            this.loadFriends();
        } catch (err) {
            console.error("Friend request error:", err);
        }
    }

    async acceptFriend(friendshipId) {
        try {
            const res = await fetch(`${API_BASE}/friends/${friendshipId}/accept`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (res.ok) this.loadFriends();
        } catch (err) {
            console.error("Accept friend error:", err);
        }
    }

    async removeFriend(friendshipId) {
        try {
            const res = await fetch(`${API_BASE}/friends/${friendshipId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (res.ok) this.loadFriends();
        } catch (err) {
            console.error("Remove friend error:", err);
        }
    }

    /* ====================================
       CALL HISTORY
    ==================================== */

    async loadCallHistory() {
        try {
            const res = await fetch(`${API_BASE}/calls`, {
                headers: { Authorization: `Bearer ${this.token}` },
            });
            if (!res.ok) return;
            const calls = await res.json();
            this.renderCallHistory(calls);
        } catch (err) {
            console.error("Load calls error:", err);
        }
    }

    renderCallHistory(calls) {
        this.callsList.innerHTML = "";

        if (calls.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.textContent = "No call history yet";
            this.callsList.appendChild(empty);
            return;
        }

        calls.forEach((call) => {
            const li = document.createElement("li");
            li.className = "call-item";

            const isCaller = call.callerId === this.userId;
            const otherUser = isCaller ? call.callee.username : call.caller.username;

            const iconWrap = document.createElement("span");
            iconWrap.className = "call-direction";
            const dirIcon = createIcon(isCaller ? "phone-out" : "phone-in", 16);
            iconWrap.appendChild(dirIcon);

            const info = document.createElement("div");
            info.className = "call-info-item";

            const name = document.createElement("div");
            name.className = "call-name";
            name.textContent = otherUser;

            const meta = document.createElement("div");
            meta.className = "call-meta";

            const statusText = call.status === "completed" ? "Completed" : call.status === "rejected" ? "Rejected" : "Missed";
            const duration = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "";
            const time = new Date(call.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            meta.textContent = `${statusText} ${duration ? `• ${duration}` : ""} • ${time}`;

            info.appendChild(name);
            info.appendChild(meta);

            li.appendChild(iconWrap);
            li.appendChild(info);
            this.callsList.appendChild(li);
        });
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

            if (user !== this.username) {
                const actions = document.createElement("div");
                actions.className = "user-actions";

                const dmBtn = document.createElement("button");
                dmBtn.className = "user-action-btn";
                dmBtn.title = "Send DM";
                dmBtn.appendChild(createIcon("message", 14));
                dmBtn.addEventListener("click", () => this.startDM(user));

                const callBtn = document.createElement("button");
                callBtn.className = "call-user-btn";
                callBtn.title = "Video Call";
                callBtn.appendChild(createIcon("video", 14));
                callBtn.addEventListener("click", () => this.startCall(user));

                actions.appendChild(dmBtn);
                actions.appendChild(callBtn);
                li.appendChild(actions);
            }

            this.usersList.appendChild(li);
        });
    }

    /* ====================================
       WEBRTC — START CALL
    ==================================== */

    async startCall(targetUser) {
        if (this.peerConnection) {
            alert("You are already in a call.");
            return;
        }

        this.callTarget = targetUser;
        this.isCaller = true;

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.localVideo.srcObject = this.localStream;
            this.createPeerConnection();
            this.localStream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.socket.send(JSON.stringify({
                type: "offer",
                from: this.username,
                to: targetUser,
                sdp: offer,
            }));

            this.callPeerName.textContent = `Calling ${targetUser}...`;
            this.videoOverlay.classList.add("active");
            this.resetCallControls();
        } catch (err) {
            console.error("Failed to start call:", err);
            alert("Could not access camera/microphone.");
            this.cleanupCall();
        }
    }

    handleOffer(data) {
        if (data.to !== this.username) return;
        if (this.peerConnection) {
            this.socket.send(JSON.stringify({
                type: "call-rejected", from: this.username, to: data.from,
            }));
            return;
        }
        this.incomingOffer = data;
        this.incomingCaller = data.from;
        this.callerNameEl.textContent = `${data.from} is calling you...`;
        this.incomingModal.classList.add("active");
    }

    async acceptCall() {
        this.incomingModal.classList.remove("active");
        if (!this.incomingOffer) return;

        this.callTarget = this.incomingCaller;
        this.isCaller = false;

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true, audio: true,
            });
            this.localVideo.srcObject = this.localStream;
            this.createPeerConnection();
            this.localStream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(this.incomingOffer.sdp)
            );

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.send(JSON.stringify({
                type: "answer", from: this.username, to: this.incomingCaller, sdp: answer,
            }));

            this.callPeerName.textContent = `In call with ${this.callTarget}`;
            this.videoOverlay.classList.add("active");
            this.resetCallControls();
        } catch (err) {
            console.error("Failed to accept call:", err);
            this.cleanupCall();
        }

        this.incomingOffer = null;
        this.incomingCaller = null;
    }

    rejectCall() {
        this.incomingModal.classList.remove("active");
        if (this.incomingCaller) {
            this.socket.send(JSON.stringify({
                type: "call-rejected", from: this.username, to: this.incomingCaller,
            }));
        }
        this.incomingOffer = null;
        this.incomingCaller = null;
    }

    async handleAnswer(data) {
        if (data.to !== this.username || !this.peerConnection) return;
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.sdp)
            );
            this.callPeerName.textContent = `In call with ${data.from}`;
            console.log(`Call connected with ${data.from}`);

            if (this.pendingIceCandidates.length > 0) {
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.error("Failed to add queued ICE candidate:", err);
                    }
                }
                this.pendingIceCandidates = [];
            }
        } catch (err) {
            console.error("Failed to set remote description:", err);
        }
    }

    async handleIceCandidate(data) {
        if (data.to !== this.username || !this.peerConnection) return;

        if (!this.peerConnection.remoteDescription) {
            this.pendingIceCandidates.push(data.candidate);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error("Failed to add ICE candidate:", err);
        }
    }

    handleCallRejected(data) {
        if (data.to !== this.username) return;
        alert(`${data.from} rejected your call.`);
        this.cleanupCall();
    }

    handleCallEnded(data) {
        if (data.to !== this.username) return;
        this.addSystemMessage(`Call with ${data.from} ended`);
        this.cleanupCall();
    }

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.iceServers);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.send(JSON.stringify({
                    type: "ice-candidate",
                    from: this.username,
                    to: this.callTarget,
                    candidate: event.candidate,
                }));
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteVideo.srcObject = event.streams[0];
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection?.iceConnectionState;
            if (state === "disconnected" || state === "failed" || state === "closed") {
                this.addSystemMessage("Call disconnected");
                this.cleanupCall();
            }
        };
    }

    endCall() {
        if (this.socket && this.callTarget) {
            this.socket.send(JSON.stringify({
                type: "call-ended", from: this.username, to: this.callTarget,
            }));
        }
        this.addSystemMessage("Call ended");
        this.cleanupCall();
        this.loadCallHistory();
    }

    cleanupCall() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }
        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        this.videoOverlay.classList.remove("active");
        this.incomingModal.classList.remove("active");
        this.callTarget = null;
        this.isCaller = false;
        this.micEnabled = true;
        this.cameraEnabled = true;
        this.incomingOffer = null;
        this.incomingCaller = null;
        this.pendingIceCandidates = [];
    }

    toggleMic() {
        if (!this.localStream) return;
        this.micEnabled = !this.micEnabled;
        this.localStream.getAudioTracks().forEach((track) => {
            track.enabled = this.micEnabled;
        });
        this.updateMicButton();
    }

    updateMicButton() {
        const span = this.toggleMicBtn.querySelector("span");
        const svg = this.toggleMicBtn.querySelector("svg");
        svg.innerHTML = "";
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", this.micEnabled ? "#icon-mic" : "#icon-mic-off");
        svg.appendChild(use);
        span.textContent = this.micEnabled ? "Mute" : "Unmute";
        this.toggleMicBtn.className = `control-btn ${this.micEnabled ? "active" : "muted"}`;
    }

    toggleCamera() {
        if (!this.localStream) return;
        this.cameraEnabled = !this.cameraEnabled;
        this.localStream.getVideoTracks().forEach((track) => {
            track.enabled = this.cameraEnabled;
        });
        this.updateCameraButton();
    }

    updateCameraButton() {
        const span = this.toggleCameraBtn.querySelector("span");
        const svg = this.toggleCameraBtn.querySelector("svg");
        svg.innerHTML = "";
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", this.cameraEnabled ? "#icon-camera" : "#icon-camera-off");
        svg.appendChild(use);
        span.textContent = this.cameraEnabled ? "Camera Off" : "Camera On";
        this.toggleCameraBtn.className = `control-btn ${this.cameraEnabled ? "active" : "muted"}`;
    }

    resetCallControls() {
        this.micEnabled = true;
        this.cameraEnabled = true;
        this.updateMicButton();
        this.updateCameraButton();
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    new ChatClient();
});
