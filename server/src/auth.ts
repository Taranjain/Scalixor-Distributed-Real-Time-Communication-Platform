import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const SALT_ROUNDS = 10;

/* ================================
   PASSWORD HASHING
================================ */

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/* ================================
   JWT TOKENS
================================ */

export interface TokenPayload {
    userId: string;
    username: string;
}

export function generateToken(userId: string, username: string): string {
    return jwt.sign({ userId, username } as TokenPayload, JWT_SECRET, {
        expiresIn: "7d",
    });
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
        return null;
    }
}
