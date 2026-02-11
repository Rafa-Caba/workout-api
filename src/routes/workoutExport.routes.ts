import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateQuery } from "../middlewares/validateQuery";
import { exportWorkout } from "../controllers/workoutExport.controller";
import { workoutExportQuerySchema } from "../validations/workoutExport.schemas";

const router = Router();

// GET /api/workout/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv&scope=day|session|exercise&includeRaw=true|false
router.get(
    "/export",
    requireAuth,
    validateQuery(workoutExportQuerySchema),
    asyncHandler(exportWorkout)
);

export default router;
