import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";

type AccessPayload = {
    userId: string;
    role: "admin" | "user";
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        return next({ status: 401, code: "UNAUTHORIZED", message: "Missing access token" });
    }

    try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;

        req.user = {
            id: payload.userId,
            role: payload.role,
        };

        return next();
    } catch {
        return next({ status: 401, code: "UNAUTHORIZED", message: "Invalid or expired access token" });
    }
};
