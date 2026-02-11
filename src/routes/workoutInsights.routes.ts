import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as insightsController from "../controllers/workoutInsights.controller";
import { prQuerySchema, recoveryQuerySchema, streaksQuerySchema } from "../validations/workoutInsights.schemas";

const router = Router();

/**
 * =========================================================
 * Base: /workout/insights
 * =========================================================
 */

router.get(
    "/insights/prs",
    requireAuth,
    validate("query", prQuerySchema),
    insightsController.getPrsController
);

router.get(
    "/insights/streaks",
    requireAuth,
    validate("query", streaksQuerySchema),
    insightsController.getStreaksController
);

router.get(
    "/insights/recovery",
    requireAuth,
    validate("query", recoveryQuerySchema),
    insightsController.getRecoveryController
);

export default router;
