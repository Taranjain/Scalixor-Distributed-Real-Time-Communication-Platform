# 🚀 Real-Time Chat Application

A scalable real-time chat application built using Node.js, Express, Socket.IO, Redis, and Docker.
Designed for low-latency communication and horizontal scalability in distributed environments.

# 📌 Overview

This application enables instant messaging using WebSockets.
Redis Pub/Sub is used to synchronize messages across multiple server instances, making the system horizontally scalable.
Docker ensures consistent development and production environments.

# 🛠 Tech Stack

Backend: Node.js, Express.js

Real-Time Communication: Socket.IO (WebSockets)

Message Broker: Redis (Pub/Sub)

Containerization: Docker

Authentication: JWT

Database: MongoDB (if used)

# 🏗 System Architecture Diagram
🔹 High-Level Architecture
Diagram
graph TD
    A[Client 1] -->|WebSocket| B[Node.js Server Instance 1]
    C[Client 2] -->|WebSocket| D[Node.js Server Instance 2]
    
    B -->|Publish| E[Redis Pub/Sub]
    D -->|Publish| E
    
    E -->|Broadcast| B
    E -->|Broadcast| D

🔹 Dockerized Architecture
Diagram
graph LR
    A[User Browser] --> B[Docker Container - Server 1]
    A --> C[Docker Container - Server 2]
    
    B --> D[Redis Container]
    C --> D
    
    D --> B
    D --> C

# ⚙️ How It Works

Client connects via WebSocket.

Server receives message.

Message is published to Redis.

Redis broadcasts message to all server instances.

All connected clients receive the update instantly.

# ⚡ Features

💬 Real-time messaging

🔄 Redis-based distributed communication

📦 Docker containerization

🔐 JWT authentication

🚀 Horizontally scalable architecture

# 🚀 Running the Application
Using Docker
`docker-compose up --build`

Without Docker
`npm install
npm run dev`

# 🎯 Why This Project?

This project demonstrates:

Real-time event-driven architecture

Distributed system design

Container orchestration fundamentals

Backend scalability principles

#👨‍💻 Author

Shivam Kumar Singh
Full-Stack Developer | SDE Aspirant
