import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model";

/**
 * Ensure the authenticated user is a trainer (coachMode === "TRAINER") or admin.
 * Must be used AFTER requireAuth.
 */
export const requireTrainer = async (req: Request, _res: Response, next: NextFunction) => {
    const authUser = (req as any).user as { id: string; role: "admin" | "user" } | undefined;

    if (!authUser) {
        return next({
            statusCode: 401,
            code: "UNAUTHORIZED",
            message: "Missing access token",
        });
    }

    // Admin bypass
    if (authUser.role === "admin") return next();

    const user = await UserModel.findById(authUser.id).select("coachMode").lean().exec();
    if (!user) {
        return next({
            statusCode: 401,
            code: "UNAUTHORIZED",
            message: "User not found",
        });
    }

    if (user.coachMode !== "TRAINER") {
        return next({
            statusCode: 403,
            code: "FORBIDDEN",
            message: "Trainer only",
        });
    }

    return next();
};