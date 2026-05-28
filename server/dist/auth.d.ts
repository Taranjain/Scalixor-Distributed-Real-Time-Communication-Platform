export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export interface TokenPayload {
    userId: string;
    username: string;
}
export declare function generateToken(userId: string, username: string): string;
export declare function verifyToken(token: string): TokenPayload | null;
//# sourceMappingURL=auth.d.ts.map