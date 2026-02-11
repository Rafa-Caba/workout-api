import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as workoutSummaryController from "../controllers/workoutSummary.controller";
import {
    daySummaryParamsSchema,
    mediaStatsQuerySchema,
    rangeSummaryQuerySchema,
    weekSummaryParamsSchema,
    weeksTrendQuerySchema,
} from "../validations/workoutSummary.schemas";

const router = Router();

/**
 * =========================================================
 * Summary + Trends (Base: /workout/*)
 * =========================================================
 */

router.get(
    "/days/:date/summary",
    requireAuth,
    validate("params", daySummaryParamsSchema),
    workoutSummaryController.getDaySummaryController
);

router.get(
    "/weeks/:weekKey/summary",
    requireAuth,
    validate("params", weekSummaryParamsSchema),
    workoutSummaryController.getWeekSummaryController
);

router.get(
    "/summary",
    requireAuth,
    validate("query", rangeSummaryQuerySchema),
    workoutSummaryController.getRangeSummaryController
);

router.get(
    "/trends/weeks",
    requireAuth,
    validate("query", weeksTrendQuerySchema),
    workoutSummaryController.getWeeksTrendController
);

router.get(
    "/weeks/:weekKey/plan-vs-actual",
    requireAuth,
    validate("params", weekSummaryParamsSchema),
    workoutSummaryController.getPlanVsActualWeekController
);

router.get(
    "/media/stats",  // <----- This one
    requireAuth,
    validate("query", mediaStatsQuerySchema),
    workoutSummaryController.getMediaStatsController
);

export default router;
