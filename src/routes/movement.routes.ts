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
import { uploadMovementMedia } from "../middlewares/cloudinary";

const router = Router();

// Listar movimientos (sin cambios, JSON)
router.get(
    "/movements",
    requireAuth,
    validate({ query: listMovementsQuerySchema }),
    MovementController.list
);

// Crear movimiento (ahora acepta multipart/form-data con "media")
router.post(
    "/movements",
    requireAuth,
    uploadMovementMedia.single("media"),
    validate({ body: createMovementSchema }),
    MovementController.create
);

router.put(
    "/movements/:id",
    requireAuth,
    uploadMovementMedia.single("media"),
    validate({ params: movementIdParamSchema, body: updateMovementSchema }),
    MovementController.update
);

// Obtener por id (sin cambios, JSON)
router.get(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.getById
);



// Eliminar movimiento (sin cambios)
router.delete(
    "/movements/:id",
    requireAuth,
    validate({ params: movementIdParamSchema }),
    MovementController.remove
);

export default router;
