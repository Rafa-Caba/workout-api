// src/routes/workoutSession.routes.ts

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import * as workoutSessionController from "../controllers/workoutSession.controller";

import {
    dayParamsOnlySchema,
    sessionCrudParamsSchema,
    createSessionBodySchema,
    patchSessionBodySchema,
    sessionCrudQuerySchema,
} from "../validations/workoutSession.schemas";

const router = Router();

/**
 * =========================================================
 * Session CRUD
 * =========================================================
 */

router.post(
    "/days/:date/sessions",
    requireAuth,
    validate("params", dayParamsOnlySchema),
    validate("query", sessionCrudQuerySchema.pick({ returnMode: true })),
    validate("body", createSessionBodySchema),
    workoutSessionController.createSession
);

router.patch(
    "/days/:date/sessions/:sessionId",
    requireAuth,
    validate("params", sessionCrudParamsSchema),
    validate("query", sessionCrudQuerySchema.pick({ returnMode: true })),
    validate("body", patchSessionBodySchema),
    workoutSessionController.patchSession
);

router.delete(
    "/days/:date/sessions/:sessionId",
    requireAuth,
    validate("params", sessionCrudParamsSchema),
    validate("query", sessionCrudQuerySchema),
    workoutSessionController.deleteSession
);

export default router;