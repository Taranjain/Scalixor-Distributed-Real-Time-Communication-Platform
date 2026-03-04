// chat.js
class ChatClient {
    constructor() {
        this.socket = null;
        this.username = "";
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // DOM elements
        this.messagesDiv = document.getElementById("messages");
        this.chatSection = document.getElementById("chat-section");
        this.connectSection = document.getElementById("connect-section");
        this.usernameInput = document.getElementById("username");
        this.messageInput = document.getElementById("message");
        this.connectBtn = document.getElementById("connect-btn");
        this.sendBtn = document.getElementById("send-btn");
        this.leaveBtn = document.getElementById("leave-btn");
        this.statusDiv = document.getElementById("connection-status");
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.connectBtn.addEventListener('click', this.connect);
        this.sendBtn.addEventListener('click', this.sendMessage);
        this.leaveBtn.addEventListener('click', this.disconnect);
        
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.connect();
        });
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }
    
    updateStatus(message, isConnected = false) {
        if (this.statusDiv) {
            this.statusDiv.textContent = message;
            this.statusDiv.className = isConnected ? 'status-connected' : 'status-disconnected';
        }
    }
    
    connect() {
        this.username = this.usernameInput.value.trim();
        
        if (!this.username) {
            alert("Please enter a username");
            this.usernameInput.focus();
            return;
        }
        
        try {
            // Connect to WebSocket server
            this.socket = new WebSocket("ws://localhost:5001");
            
            this.socket.onopen = () => {
                console.log("✅ Connected to server");
                this.reconnectAttempts = 0;
                this.updateStatus(`Connected as ${this.username}`, true);
                
                // Show chat section
                this.connectSection.style.display = "none";
                this.chatSection.style.display = "block";
                this.messageInput.focus();
                
                // Notify server about new user
                this.socket.send(JSON.stringify({
                    type: "event",
                    action: "joined",
                    user: this.username
                }));
                
                this.addSystemMessage(`✨ ${this.username} joined the chat`);
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch(data.type) {
                        case "message":
                            this.addMessage(data.user, data.content);
                            break;
                        case "event":
                            this.addSystemMessage(`${data.user} ${data.action}`);
                            break;
                        default:
                            console.log("Unknown message type:", data);
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            };
            
            this.socket.onclose = () => {
                console.log("🔌 Disconnected from server");
                this.updateStatus("Disconnected", false);
                
                // Reset UI
                this.connectSection.style.display = "block";
                this.chatSection.style.display = "none";
                this.usernameInput.focus();
                
                // Attempt to reconnect if not manual disconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    this.addSystemMessage(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => this.connect(), 2000);
                } else {
                    this.addSystemMessage("❌ Could not reconnect to server. Please refresh the page.");
                }
            };
            
            this.socket.onerror = (error) => {
                console.error("❌ WebSocket error:", error);
                this.updateStatus("Connection error", false);
                this.addSystemMessage("❌ Connection error. Please try again.");
            };
            
        } catch (error) {
            console.error("Connection error:", error);
            alert("Failed to connect to server. Please make sure the server is running.");
        }
    }
    
    sendMessage() {
        const content = this.messageInput.value.trim();
        
        if (!content) return;
        
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            alert("Not connected to server");
            return;
        }
        
        // Send message to server
        this.socket.send(JSON.stringify({
            type: "message",
            user: this.username,
            content: content
        }));
        
        // Clear input
        this.messageInput.value = "";
        this.messageInput.focus();
    }
    
    disconnect() {
        if (!this.socket) return;
        
        if (this.socket.readyState === WebSocket.OPEN) {
            // Notify others
            this.socket.send(JSON.stringify({
                type: "event",
                action: "left",
                user: this.username
            }));
            
            this.addSystemMessage(`👋 ${this.username} left the chat`);
        }
        
        this.socket.close();
        this.socket = null;
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    }
    
    addMessage(user, content) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${user === this.username ? 'mine' : 'other'}`;
        
        const senderDiv = document.createElement("div");
        senderDiv.className = "sender";
        senderDiv.textContent = user === this.username ? 'You' : user;
        
        const textDiv = document.createElement("div");
        textDiv.className = "text";
        textDiv.textContent = content;
        
        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(textDiv);
        
        this.messagesDiv.appendChild(messageDiv);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }
    
    addSystemMessage(text) {
        const messageDiv = document.createElement("div");
        messageDiv.className = "message system";
        messageDiv.textContent = text;
        
        this.messagesDiv.appendChild(messageDiv);
        this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatClient();
});