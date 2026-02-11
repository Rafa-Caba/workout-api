import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as workoutMediaController from "../controllers/workoutMedia.controller";
import { mediaDeleteQuerySchema, mediaFeedQuerySchema, mediaGroupedQuerySchema } from "../validations/workoutMedia.schemas";

const router = Router();

/**
 * =========================================================
 * GET /workout/media
 * GET /workout/media/grouped
 * DELETE /workout/media?publicId=...&deleteCloudinary=true|false
 * =========================================================
 */

router.get("/media", requireAuth, validate("query", mediaFeedQuerySchema), workoutMediaController.getMedia);

router.get(
    "/media/grouped",
    requireAuth,
    validate("query", mediaGroupedQuerySchema),
    workoutMediaController.getMediaGroupedView
);

router.delete(
    "/media",
    requireAuth,
    validate("query", mediaDeleteQuerySchema),
    workoutMediaController.deleteMedia
);

export default router;
