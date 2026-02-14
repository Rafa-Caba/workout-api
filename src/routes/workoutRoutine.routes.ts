import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as routineController from "../controllers/workoutRoutine.controller";
import {
    routineArchiveQuerySchema,
    routineInitQuerySchema,
    routineUpsertBodySchema,
    routineWeekParamsSchema,
    routineAttachmentDeleteQuerySchema,
    routineAttachmentUploadQuerySchema,
    routineGymCheckParamsSchema,
    routineGymCheckPatchBodySchema,
} from "../validations/workoutRoutine.schemas";
import { uploadTrainingMedia } from "../middlewares/cloudinary";

const router = Router();

/**
 * =========================================================
 * Base: /workout/routines
 * =========================================================
 */

router.post(
    "/routines/weeks/:weekKey/init",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    validate("query", routineInitQuerySchema),
    routineController.initWeekRoutine
);

router.get(
    "/routines/weeks/:weekKey",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    routineController.getWeekRoutine
);

router.put(
    "/routines/weeks/:weekKey",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    validate("body", routineUpsertBodySchema),
    routineController.updateWeekRoutine
);

router.patch(
    "/routines/weeks/:weekKey/archive",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    validate("query", routineArchiveQuerySchema),
    routineController.archiveWeekRoutine
);

/**
 * =========================================================
 * Gym Check (sync routine checklist + notes + duration)
 * PATCH /api/workout/routines/weeks/:weekKey/gym-check/:dayKey
 * =========================================================
 */
router.patch(
    "/routines/weeks/:weekKey/gym-check/:dayKey",
    requireAuth,
    validate("params", routineGymCheckParamsSchema),
    validate("body", routineGymCheckPatchBodySchema),
    routineController.patchGymCheckForDay
);

/**
 * =========================================================
 * Attachments
 * - POST: upload files to routine week
 * - DELETE: remove by publicId + optional cloud delete
 * =========================================================
 */
router.post(
    "/routines/weeks/:weekKey/attachments",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    validate("query", routineAttachmentUploadQuerySchema),
    uploadTrainingMedia.fields([
        { name: "file", maxCount: 1 },
        { name: "files", maxCount: 10 },
    ]),
    routineController.addWeekRoutineAttachments
);

router.delete(
    "/routines/weeks/:weekKey/attachments",
    requireAuth,
    validate("params", routineWeekParamsSchema),
    validate("query", routineAttachmentDeleteQuerySchema),
    routineController.deleteWeekRoutineAttachment
);

export default router;
