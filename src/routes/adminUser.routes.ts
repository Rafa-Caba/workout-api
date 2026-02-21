// src/routes/adminUser.routes.ts
import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middlewares/validate";

import * as adminUserController from "../controllers/adminUser.controller";
import {
    adminCreateUserSchema,
    adminUpdateUserSchema,
    adminUpdatePasswordSchema,
    adminListUsersQuerySchema,
    adminUserIdParamsSchema,
} from "../validations/adminUser.schemas";

const router = Router();

// All routes here require authenticated admin
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users
 * Query: q, role, coachMode, page, limit, isActive (manual parse in controller)
 */
router.get(
    "/",
    validate("query", adminListUsersQuerySchema),
    asyncHandler(adminUserController.listUsers)
);

/**
 * Optional convenience endpoints:
 * GET /api/admin/users/trainers
 * GET /api/admin/users/trainees
 *
 * These do not replace /; they just avoid sending coachMode query from FE if you want.
 */
router.get(
    "/trainers",
    asyncHandler(async (req, res) => {
        // Reuse listUsers by injecting query
        (req as any).validatedQuery = {
            ...(req as any).validatedQuery,
            ...req.query,
            coachMode: "TRAINER",
            page: (req.query as any).page ?? "1",
            limit: (req.query as any).limit ?? "20",
        };
        return adminUserController.listUsers(req, res);
    })
);

router.get(
    "/trainees",
    asyncHandler(async (req, res) => {
        (req as any).validatedQuery = {
            ...(req as any).validatedQuery,
            ...req.query,
            coachMode: "TRAINEE",
            page: (req.query as any).page ?? "1",
            limit: (req.query as any).limit ?? "20",
        };
        return adminUserController.listUsers(req, res);
    })
);

/**
 * POST /api/admin/users
 */
router.post(
    "/",
    validate("body", adminCreateUserSchema),
    asyncHandler(adminUserController.createUser)
);

/**
 * GET /api/admin/users/:id
 */
router.get(
    "/:id",
    validate("params", adminUserIdParamsSchema),
    asyncHandler(adminUserController.getUserById)
);

/**
 * PATCH /api/admin/users/:id
 */
router.patch(
    "/:id",
    validate("params", adminUserIdParamsSchema),
    validate("body", adminUpdateUserSchema),
    asyncHandler(adminUserController.updateUser)
);

/**
 * PATCH /api/admin/users/:id/password
 */
router.patch(
    "/:id/password",
    validate("params", adminUserIdParamsSchema),
    validate("body", adminUpdatePasswordSchema),
    asyncHandler(adminUserController.updateUserPassword)
);

/**
 * DELETE /api/admin/users/:id/purge
 */
router.delete(
    "/:id/purge",
    validate("params", adminUserIdParamsSchema),
    asyncHandler(adminUserController.purgeUser)
);

/**
 * DELETE /api/admin/users/:id
 */
router.delete(
    "/:id",
    validate("params", adminUserIdParamsSchema),
    asyncHandler(adminUserController.deleteUser)
);

export default router;