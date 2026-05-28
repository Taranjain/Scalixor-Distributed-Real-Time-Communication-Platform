import { Request } from "express";
import { TokenPayload } from "./auth";
declare const router: import("express-serve-static-core").Router;
export interface AuthRequest extends Request {
    user?: TokenPayload;
}
export default router;
//# sourceMappingURL=routes.d.ts.map