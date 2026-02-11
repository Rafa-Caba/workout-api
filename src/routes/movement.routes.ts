import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";

import {
    createMovementSchema,
    listMovementsQuerySchema,
    movementIdParamSchema,
    updateMovementSchema,
} from "../validations/movement.schemas";

import * as MovementController from "../controllers/movement.controller";

const router = Router();

router.get(
    "/movements",
    requireAuth,
    validate({ query: listMovementsQuerySchema }),
    MovementController.list
);

router.post(
    "/movements",
    requireAuth,
    validate({ body: createMovementSchema }),
    MovementController.create
);

router.get(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.getById
);

router.put(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema, body: updateMovementSchema }),
    MovementController.update
);

router.delete(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.remove
);

export default router;
