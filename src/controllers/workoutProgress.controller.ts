// src/controllers/workoutProgress.controller.ts
// Exposes the Workout Progress overview endpoint.

import type { Request, Response } from "express";
import { getWorkoutProgressOverview } from "../services/workoutProgress.service";
import type { WorkoutProgressOverviewQueryParsed } from "../validations/workoutProgress.schemas";

const getUserIdFromReq = (req: Request): string => String(req.user?.id ?? "");

const getValidatedQuery = (req: Request): WorkoutProgressOverviewQueryParsed => {
    const validatedQuery = req.validatedQuery ?? req.query;
    return validatedQuery as WorkoutProgressOverviewQueryParsed;
};

export const getWorkoutProgressOverviewController = async (
    req: Request,
    res: Response
) => {
    const userId = getUserIdFromReq(req);
    const query = getValidatedQuery(req);

    const out = await getWorkoutProgressOverview(userId, {
        mode: query.mode,
        from: query.from,
        to: query.to,
        compareTo: query.compareTo,
        weekKey: query.weekKey,
        includeExerciseProgress: query.includeExerciseProgress,
    });

    return res.status(200).json(out);
};