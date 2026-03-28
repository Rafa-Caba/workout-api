// /src/routes/movement.routes.ts

import { Router } from "express";

import * as MovementController from "../controllers/movement.controller";
import { uploadMovementMedia } from "../middlewares/cloudinary";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import {
    createMovementSchema,
    listMovementsQuerySchema,
    movementIdParamSchema,
    updateMovementSchema,
} from "../validations/movement.schemas";

const router = Router();

/**
 * List movements.
 */
router.get(
    "/movements",
    requireAuth,
    validate({ query: listMovementsQuerySchema }),
    MovementController.list
);

/**
 * Create movement.
 * Accepts multipart/form-data with optional "media" file.
 */
router.post(
    "/movements",
    requireAuth,
    uploadMovementMedia.single("media"),
    validate({ body: createMovementSchema }),
    MovementController.create
);

/**
 * Update movement.
 * Accepts multipart/form-data with optional "media" file.
 */
router.put(
    "/movements/:id",
    requireAuth,
    uploadMovementMedia.single("media"),
    validate({
        params: movementIdParamSchema,
        body: updateMovementSchema,
    }),
    MovementController.update
);

/**
 * Get movement by id.
 */
router.get(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.getById
);

/**
 * Delete movement.
 */
router.delete(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.remove
);

export default router;