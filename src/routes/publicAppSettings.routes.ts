import { Router } from "express";
import { getPublicAppSettings } from "../controllers/publicAppSettings.controller";

const router = Router();

// GET /api/app-settings (public)
router.get("/", getPublicAppSettings);

export default router;
