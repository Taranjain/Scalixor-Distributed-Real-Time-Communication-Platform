import { Router, Request, Response, NextFunction } from "express";
import prisma from "./prisma";
import {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    TokenPayload,
} from "./auth";

const router = Router();

/* ================================
   AUTH MIDDLEWARE
================================ */

export interface AuthRequest extends Request {
    user?: TokenPayload;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid token" });
        return;
    }

    const token = header.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    req.user = payload;
    next();
}

/* ================================
   AUTH ROUTES
================================ */

// POST /api/auth/signup
router.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            res.status(400).json({ error: "username, email, and password are required" });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: "Password must be at least 6 characters" });
            return;
        }

        // Check if username or email already exists
        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
        });
        if (existing) {
            res.status(409).json({ error: "Username or email already taken" });
            return;
        }

        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
            data: { username, email, passwordHash },
        });

        const token = generateToken(user.id, user.username);
        res.status(201).json({
            token,
            user: { id: user.id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/login
router.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: "username and password are required" });
            return;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const token = generateToken(user.id, user.username);
        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* ================================
   ROOM ROUTES
================================ */

// GET /api/rooms — list user's rooms
router.get("/api/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { members: { some: { userId: req.user!.userId } } },
            include: {
                members: { include: { user: { select: { id: true, username: true } } } },
                _count: { select: { messages: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(rooms);
    } catch (err) {
        console.error("List rooms error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/rooms — create a room
router.post("/api/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: "Room name is required" });
            return;
        }

        const room = await prisma.room.create({
            data: {
                name,
                isGroup: true,
                members: {
                    create: { userId: req.user!.userId },
                },
            },
            include: {
                members: { include: { user: { select: { id: true, username: true } } } },
            },
        });

        res.status(201).json(room);
    } catch (err) {
        console.error("Create room error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/rooms/join — join a room by its ID
router.post("/api/rooms/join", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { roomId } = req.body;
        if (!roomId) {
            res.status(400).json({ error: "roomId is required" });
            return;
        }

        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            res.status(404).json({ error: "Room not found" });
            return;
        }

        // Check if already a member
        const existing = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId: req.user!.userId, roomId } },
        });
        if (existing) {
            // Already a member, just return the room
            const fullRoom = await prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    members: { include: { user: { select: { id: true, username: true } } } },
                },
            });
            res.json(fullRoom);
            return;
        }

        await prisma.roomMember.create({
            data: { userId: req.user!.userId, roomId },
        });

        const fullRoom = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
                members: { include: { user: { select: { id: true, username: true } } } },
            },
        });

        res.json(fullRoom);
    } catch (err) {
        console.error("Join room error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/rooms/:id/messages — paginated chat history
router.get(
    "/api/rooms/:id/messages",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const { id } = req.params;
            const cursor = req.query.cursor as string | undefined;
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

            // Verify membership
            const membership = await prisma.roomMember.findUnique({
                where: { userId_roomId: { userId: req.user!.userId, roomId: id } },
            });
            if (!membership) {
                res.status(403).json({ error: "You are not a member of this room" });
                return;
            }

            const messages = await prisma.message.findMany({
                where: { roomId: id },
                include: { sender: { select: { id: true, username: true } } },
                orderBy: { createdAt: "desc" },
                take: limit + 1, // +1 to check if there are more
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });

            const hasMore = messages.length > limit;
            if (hasMore) messages.pop();

            res.json({
                messages: messages.reverse(),
                nextCursor: hasMore ? messages[0]?.id : null,
            });
        } catch (err) {
            console.error("Get messages error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

/* ================================
   DM (Direct Message) ROUTES
================================ */

// POST /api/dm — get or create a DM room with another user
router.post("/api/dm", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { targetUsername } = req.body;
        if (!targetUsername) {
            res.status(400).json({ error: "targetUsername is required" });
            return;
        }

        const targetUser = await prisma.user.findUnique({
            where: { username: targetUsername },
        });
        if (!targetUser) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        if (targetUser.id === req.user!.userId) {
            res.status(400).json({ error: "Cannot DM yourself" });
            return;
        }

        // Check if a DM room already exists between these two users
        const existingRoom = await prisma.room.findFirst({
            where: {
                isGroup: false,
                AND: [
                    { members: { some: { userId: req.user!.userId } } },
                    { members: { some: { userId: targetUser.id } } },
                ],
            },
            include: {
                members: { include: { user: { select: { id: true, username: true } } } },
            },
        });

        if (existingRoom) {
            res.json(existingRoom);
            return;
        }

        // Create new DM room
        const room = await prisma.room.create({
            data: {
                name: `DM: ${req.user!.username} & ${targetUser.username}`,
                isGroup: false,
                members: {
                    create: [
                        { userId: req.user!.userId },
                        { userId: targetUser.id },
                    ],
                },
            },
            include: {
                members: { include: { user: { select: { id: true, username: true } } } },
            },
        });

        res.status(201).json(room);
    } catch (err) {
        console.error("DM error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* ================================
   FRIENDS ROUTES
================================ */

// GET /api/friends — list friends + pending requests
router.get("/api/friends", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
            include: {
                requester: { select: { id: true, username: true } },
                addressee: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const result = friendships.map((f) => ({
            id: f.id,
            status: f.status,
            createdAt: f.createdAt,
            friend:
                f.requesterId === userId
                    ? f.addressee
                    : f.requester,
            isSender: f.requesterId === userId,
        }));

        res.json(result);
    } catch (err) {
        console.error("List friends error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/friends/request — send friend request
router.post(
    "/api/friends/request",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const { targetUsername } = req.body;
            if (!targetUsername) {
                res.status(400).json({ error: "targetUsername is required" });
                return;
            }

            const target = await prisma.user.findUnique({
                where: { username: targetUsername },
            });
            if (!target) {
                res.status(404).json({ error: "User not found" });
                return;
            }

            if (target.id === req.user!.userId) {
                res.status(400).json({ error: "Cannot friend yourself" });
                return;
            }

            // Check if friendship already exists in either direction
            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: req.user!.userId, addresseeId: target.id },
                        { requesterId: target.id, addresseeId: req.user!.userId },
                    ],
                },
            });

            if (existing) {
                res.status(409).json({ error: "Friend request already exists", status: existing.status });
                return;
            }

            const friendship = await prisma.friendship.create({
                data: {
                    requesterId: req.user!.userId,
                    addresseeId: target.id,
                },
                include: {
                    requester: { select: { id: true, username: true } },
                    addressee: { select: { id: true, username: true } },
                },
            });

            res.status(201).json(friendship);
        } catch (err) {
            console.error("Friend request error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// PUT /api/friends/:id/accept — accept friend request
router.put(
    "/api/friends/:id/accept",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const friendship = await prisma.friendship.findUnique({
                where: { id: req.params.id },
            });

            if (!friendship) {
                res.status(404).json({ error: "Friend request not found" });
                return;
            }

            if (friendship.addresseeId !== req.user!.userId) {
                res.status(403).json({ error: "Only the recipient can accept" });
                return;
            }

            const updated = await prisma.friendship.update({
                where: { id: req.params.id },
                data: { status: "ACCEPTED" },
                include: {
                    requester: { select: { id: true, username: true } },
                    addressee: { select: { id: true, username: true } },
                },
            });

            res.json(updated);
        } catch (err) {
            console.error("Accept friend error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// DELETE /api/friends/:id — reject or remove friend
router.delete(
    "/api/friends/:id",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
        try {
            const friendship = await prisma.friendship.findUnique({
                where: { id: req.params.id },
            });

            if (!friendship) {
                res.status(404).json({ error: "Friend request not found" });
                return;
            }

            if (
                friendship.requesterId !== req.user!.userId &&
                friendship.addresseeId !== req.user!.userId
            ) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }

            await prisma.friendship.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        } catch (err) {
            console.error("Delete friend error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

/* ================================
   CALL LOG ROUTES
   ================================ */

// GET /api/calls — list call history for current user
router.get("/api/calls", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const calls = await prisma.callLog.findMany({
            where: {
                OR: [{ callerId: userId }, { calleeId: userId }],
            },
            include: {
                caller: { select: { id: true, username: true } },
                callee: { select: { id: true, username: true } },
            },
            orderBy: { startedAt: "desc" },
            take: 50,
        });

        res.json(calls);
    } catch (err) {
        console.error("Call logs error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/* ================================
   CODE SESSION ROUTES
   ================================ */

// GET /api/rooms/:id/code — get code session for a room
router.get("/api/rooms/:id/code", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Verify membership
        const membership = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId: req.user!.userId, roomId: id } },
        });
        if (!membership) {
            res.status(403).json({ error: "You are not a member of this room" });
            return;
        }

        let session = await prisma.codeSession.findUnique({
            where: { roomId: id },
        });

        if (!session) {
            session = await prisma.codeSession.create({
                data: { roomId: id, content: "", language: "javascript" },
            });
        }

        res.json({ content: session.content, language: session.language });
    } catch (err) {
        console.error("Get code session error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/rooms/:id/code — save code session for a room
router.post("/api/rooms/:id/code", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { content, language } = req.body;

        // Verify membership
        const membership = await prisma.roomMember.findUnique({
            where: { userId_roomId: { userId: req.user!.userId, roomId: id } },
        });
        if (!membership) {
            res.status(403).json({ error: "You are not a member of this room" });
            return;
        }

        const session = await prisma.codeSession.upsert({
            where: { roomId: id },
            update: {
                content: content ?? "",
                language: language ?? "javascript",
            },
            create: {
                roomId: id,
                content: content ?? "",
                language: language ?? "javascript",
            },
        });

        res.json({ success: true, language: session.language });
    } catch (err) {
        console.error("Save code session error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
