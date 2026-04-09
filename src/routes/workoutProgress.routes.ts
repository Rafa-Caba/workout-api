// src/routes/workoutProgress.routes.ts
// Routes for the Workout Progress overview endpoint.

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as workoutProgressController from "../controllers/workoutProgress.controller";
import { workoutProgressOverviewQuerySchema } from "../validations/workoutProgress.schemas";

const router = Router();

/**
 * =========================================================
 * Base: /workout/*
 * =========================================================
 */

router.get(
    "/progress/overview",
    requireAuth,
    validate("query", workoutProgressOverviewQuerySchema),
    workoutProgressController.getWorkoutProgressOverviewController
);

export default router;