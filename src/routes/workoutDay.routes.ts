import { Router } from "express";
import z from "zod";
import * as workoutDayController from "../controllers/workoutDay.controller";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { uploadTrainingMedia } from "../middlewares/cloudinary";

import {
    dayParamsSchema,
    sessionParamsSchema,
    upsertDayQuerySchema,
    rangeQuerySchema,
    calendarQuerySchema,
    weekQuerySchema,
    mediaUploadQuerySchema,
    mediaDeleteQuerySchema,
    upsertDayBodySchema,
    attachSessionMediaQuerySchema,
    attachSessionMediaBodySchema,
} from "../validations/workoutDay.schemas";

const router = Router();

/**
 * =========================================================
 * Day CRUD
 * =========================================================
 */

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
 * =========================================================
 * Range / Calendar / Week / Stats
 * =========================================================
 */

router.get("/days", requireAuth, validate("query", rangeQuerySchema), workoutDayController.getDaysRange);

router.get("/calendar", requireAuth, validate("query", calendarQuerySchema), workoutDayController.getCalendar);

router.get(
    "/week/:weekKey",
    requireAuth,
    validate("params", z.object({ weekKey: z.string() })), // or your existing week params schema
    validate("query", weekQuerySchema),
    workoutDayController.getWeek
);

router.get(
    "/stats",
    requireAuth,
    validate("query", calendarQuerySchema.pick({ from: true, to: true })),
    workoutDayController.getStats
);

/**
 * =========================================================
 * Media endpoints
 * =========================================================
 * Accepts:
 *  - single file field: "file"
 *  - multi file field: "files"
 */

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

/**
 * =========================================================
 * NEW: Attach existing media items to a session (no upload)
 * POST /days/:date/sessions/:sessionId/media/attach?returnMode=day|session
 * body: { items: WorkoutMediaItem[] }
 * =========================================================
 */

router.post(
    "/days/:date/sessions/:sessionId/media/attach",
    requireAuth,
    validate("params", sessionParamsSchema),
    validate("query", attachSessionMediaQuerySchema),
    validate("body", attachSessionMediaBodySchema),
    workoutDayController.attachSessionMedia
);

export default router;
