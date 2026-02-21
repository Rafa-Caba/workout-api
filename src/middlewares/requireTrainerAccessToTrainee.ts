import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { UserModel } from "../models/User.model";

/**
 * Trainer can access trainee only if:
 * - trainee.coachMode === "TRAINEE"
 * - trainee.assignedTrainer === trainerId
 *
 * Admin bypass allowed.
 *
 * Must be used AFTER requireAuth + requireTrainer.
 */
export const requireTrainerAccessToTrainee = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const authUser = (req as any).user as { id: string; role: "admin" | "user" } | undefined;

    if (!authUser) {
        return next({
            statusCode: 401,
            code: "UNAUTHORIZED",
            message: "Missing access token",
        });
    }

    const traineeId = String(req.params.id);

    if (!mongoose.isValidObjectId(traineeId)) {
        return next({
            statusCode: 400,
            code: "INVALID_TRAINEE_ID",
            message: "Invalid trainee id",
        });
    }

    const trainee = await UserModel.findById(traineeId)
        .select("coachMode assignedTrainer")
        .exec();

    if (!trainee) {
        return next({
            statusCode: 404,
            code: "TRAINEE_NOT_FOUND",
            message: "Trainee not found",
        });
    }

    // Admin bypass
    if (authUser.role === "admin") return next();

    const assignedTrainerId = trainee.assignedTrainer ? String(trainee.assignedTrainer) : null;

    if (trainee.coachMode !== "TRAINEE" || assignedTrainerId !== authUser.id) {
        return next({
            statusCode: 403,
            code: "FORBIDDEN",
            message: "No access to trainee",
        });
    }

    return next();
};