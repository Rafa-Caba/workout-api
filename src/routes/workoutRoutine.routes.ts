import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import { blockTrainee } from "../middlewares/blockTrainee";
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
    routineWeeksListQuerySchema,
} from "../validations/workoutRoutine.schemas";
import { uploadTrainingMedia } from "../middlewares/cloudinary";

const router = Router();

/**
 * =========================================================
 * Base: /workout/routines
 * =========================================================
 *
 * Rule:
 * - Trainee cannot access week template CRUD endpoints.
 * - Trainee CAN access Gym Check patch endpoint.
 */

/**
 * =========================================================
 * Routine Week Templates (BLOCK TRAINEE)
 * =========================================================
 */

router.post(
    "/routines/weeks/:weekKey/init",
    requireAuth,
    blockTrainee,
    validate("params", routineWeekParamsSchema),
    validate("query", routineInitQuerySchema),
    routineController.initWeekRoutine
);

router.get(
    "/routines/weeks/:weekKey",
    requireAuth,
    blockTrainee,
    validate("params", routineWeekParamsSchema),
    routineController.getWeekRoutine
);

router.put(
    "/routines/weeks/:weekKey",
    requireAuth,
    blockTrainee,
    validate("params", routineWeekParamsSchema),
    validate("body", routineUpsertBodySchema),
    routineController.updateWeekRoutine
);

router.patch(
    "/routines/weeks/:weekKey/archive",
    requireAuth,
    blockTrainee,
    validate("params", routineWeekParamsSchema),
    validate("query", routineArchiveQuerySchema),
    routineController.archiveWeekRoutine
);

router.get(
    "/routines/weeks",
    requireAuth,
    blockTrainee,
    validate("query", routineWeeksListQuerySchema),
    routineController.listWeeks
);

/**
 * =========================================================
 * Attachments (BLOCK TRAINEE)
 * - POST: upload files to routine week
 * - DELETE: remove by publicId + optional cloud delete
 * =========================================================
 */
router.post(
    "/routines/weeks/:weekKey/attachments",
    requireAuth,
    blockTrainee,
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
    blockTrainee,
    validate("params", routineWeekParamsSchema),
    validate("query", routineAttachmentDeleteQuerySchema),
    routineController.deleteWeekRoutineAttachment
);

/**
 * =========================================================
 * Gym Check (ALLOW TRAINEE)
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

export default router;