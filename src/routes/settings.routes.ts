import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validateBody";
import * as settingsController from "../controllers/settings.controller";
import { patchMySettingsSchema } from "../validations/settings.schemas";

const router = Router();

// GET /api/settings/me
router.get("/me", requireAuth, asyncHandler(settingsController.getMySettings));

// PATCH /api/settings/me
router.patch(
    "/me",
    requireAuth,
    validateBody(patchMySettingsSchema),
    asyncHandler(settingsController.patchMySettings)
);

export default router;
