import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validateBody";
import * as adminUserController from "../controllers/adminUser.controller";
import {
    adminCreateUserSchema,
    adminUpdateUserSchema,
    adminUpdatePasswordSchema,
} from "../validations/adminUser.schemas";

const router = Router();

// All routes here require authenticated admin
router.use(requireAuth, requireAdmin);

// GET /api/admin/users
router.get("/", asyncHandler(adminUserController.listUsers));

// POST /api/admin/users
router.post(
    "/",
    validateBody(adminCreateUserSchema),
    asyncHandler(adminUserController.createUser)
);

// GET /api/admin/users/:id
router.get("/:id", asyncHandler(adminUserController.getUserById));

// PATCH /api/admin/users/:id
router.patch(
    "/:id",
    validateBody(adminUpdateUserSchema),
    asyncHandler(adminUserController.updateUser)
);

// PATCH /api/admin/users/:id/password
router.patch(
    "/:id/password",
    validateBody(adminUpdatePasswordSchema),
    asyncHandler(adminUserController.updateUserPassword)
);

// DELETE /api/admin/users/:id/purge  (hard delete + cascade)
router.delete("/:id/purge", asyncHandler(adminUserController.purgeUser));

// DELETE /api/admin/users/:id
router.delete("/:id", asyncHandler(adminUserController.deleteUser));

export default router;
