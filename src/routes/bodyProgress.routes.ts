// src/routes/bodyProgress.routes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as bodyProgressController from "../controllers/bodyProgress.controller";
import { bodyProgressOverviewQuerySchema } from "../validations/bodyProgress.schemas";

const router = Router();

// GET /api/workout/progress/body
router.get(
    "/progress/body",
    requireAuth,
    validate("query", bodyProgressOverviewQuerySchema),
    bodyProgressController.getBodyProgressOverviewController
);

export default router;