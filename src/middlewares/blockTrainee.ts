import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/User.model";

/**
 * Block trainees from accessing an endpoint.
 * Must be used AFTER requireAuth.
 *
 * Rule (MVP):
 * - If coachMode === "TRAINEE" -> 403
 * - Admin bypass
 */
export const blockTrainee = async (req: Request, _res: Response, next: NextFunction) => {
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

    if (user.coachMode === "TRAINEE") {
        return next({
            statusCode: 403,
            code: "FORBIDDEN",
            message: "Trainees cannot access routine templates",
        });
    }

    return next();
};