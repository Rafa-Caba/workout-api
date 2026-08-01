// /src/routes/workoutExport.routes.ts
// Authenticated workout export endpoints.

import { Router } from "express";

import {
    exportWorkout,
    exportWorkoutFile,
} from "../controllers/workoutExport.controller";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
    workoutExportQuerySchema,
    workoutReportRequestSchema,
} from "../validations/workoutExport.schemas";

const router = Router();

/**
 * Legacy JSON/CSV endpoint kept for compatibility.
 * GET /api/workout/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
 */
router.get(
    "/export",
    requireAuth,
    validate({ query: workoutExportQuerySchema }),
    asyncHandler(exportWorkout),
);

/**
 * Complete file endpoint used by Web, iOS, and Android.
 * POST /api/workout/export
 */
router.post(
    "/export",
    requireAuth,
    validate({ body: workoutReportRequestSchema }),
    asyncHandler(exportWorkoutFile),
);

export default router;
