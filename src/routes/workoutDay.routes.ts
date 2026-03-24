// src/routes/workoutDay.routes.ts

import { Router } from "express";
import * as workoutDayController from "../controllers/workoutDay.controller";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { uploadTrainingMedia } from "../middlewares/cloudinary";

import {
    attachSessionMediaBodySchema,
    attachSessionMediaQuerySchema,
    backfillDayQuerySchema,
    backfillRangeBodySchema,
    calendarQuerySchema,
    dayParamsSchema,
    mediaDeleteQuerySchema,
    mediaUploadQuerySchema,
    rangeQuerySchema,
    sessionParamsSchema,
    statsQuerySchema,
    upsertDayBodySchema,
    upsertDayQuerySchema,
    weekParamsSchema,
    weekQuerySchema,
} from "../validations/workoutDay.schemas";

const router = Router();

router.get("/days/:date", requireAuth, validate("params", dayParamsSchema), workoutDayController.getDay);

router.put(
    "/days/:date",
    requireAuth,
    validate("params", dayParamsSchema),
    validate("query", upsertDayQuerySchema),
    validate("body", upsertDayBodySchema),
    workoutDayController.upsertDay
);

/**
 * Historical backfill
 */
router.post(
    "/backfill/day/:date",
    requireAuth,
    validate("params", dayParamsSchema),
    validate("query", backfillDayQuerySchema),
    validate("body", upsertDayBodySchema),
    workoutDayController.backfillDay
);

router.post(
    "/backfill/range",
    requireAuth,
    validate("body", backfillRangeBodySchema),
    workoutDayController.backfillRange
);

router.get("/days", requireAuth, validate("query", rangeQuerySchema), workoutDayController.getDaysRange);

router.get("/calendar", requireAuth, validate("query", calendarQuerySchema), workoutDayController.getCalendar);

router.get(
    "/week/:weekKey",
    requireAuth,
    validate("params", weekParamsSchema),
    validate("query", weekQuerySchema),
    workoutDayController.getWeek
);

router.get(
    "/stats",
    requireAuth,
    validate("query", statsQuerySchema),
    workoutDayController.getStats
);

router.post(
    "/days/:date/sessions/:sessionId/media",
    requireAuth,
    validate("params", sessionParamsSchema),
    validate("query", mediaUploadQuerySchema),
    uploadTrainingMedia.fields([
        { name: "file", maxCount: 1 },
        { name: "files", maxCount: 10 },
    ]),
    workoutDayController.addSessionMedia
);

router.delete(
    "/days/:date/sessions/:sessionId/media",
    requireAuth,
    validate("params", sessionParamsSchema),
    validate("query", mediaDeleteQuerySchema),
    workoutDayController.deleteSessionMedia
);

router.post(
    "/days/:date/sessions/:sessionId/media/attach",
    requireAuth,
    validate("params", sessionParamsSchema),
    validate("query", attachSessionMediaQuerySchema),
    validate("body", attachSessionMediaBodySchema),
    workoutDayController.attachSessionMedia
);

export default router;