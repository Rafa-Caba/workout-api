import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validateBody";
import { updateAdminSettingsSchema } from "../validations/adminSettings.schemas";
import * as adminSettingsController from "../controllers/adminSettings.controller";
import { uploadAppLogo } from "../middlewares/cloudinary";

const router = Router();

// GET /api/admin/settings
router.get(
    "/",
    requireAuth,
    requireAdmin,
    asyncHandler(adminSettingsController.getAdminSettings)
);

// PATCH /api/admin/settings
router.patch(
    "/",
    requireAuth,
    requireAdmin,
    validateBody(updateAdminSettingsSchema),
    asyncHandler(adminSettingsController.updateAdminSettings)
);

// POST /api/admin/settings/logo  (field: "image")
router.post(
    "/logo",
    requireAuth,
    requireAdmin,
    uploadAppLogo.single("image"),
    asyncHandler(adminSettingsController.uploadLogo)
);

// DELETE /api/admin/settings/logo
router.delete(
    "/logo",
    requireAuth,
    requireAdmin,
    asyncHandler(adminSettingsController.deleteLogo)
);

export default router;
