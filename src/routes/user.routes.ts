import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validateBody";
import * as userController from "../controllers/user.controller";
import { updateMeSchema } from "../validations/user.schemas";
import { uploadUserProfilePic } from "../middlewares/cloudinary";

const router = Router();

// GET /api/users/me
router.get("/me", requireAuth, asyncHandler(userController.getMe));

// PATCH /api/users/me
router.patch(
    "/me",
    requireAuth,
    validateBody(updateMeSchema),
    asyncHandler(userController.patchMe)
);

// POST /api/users/me/profile-pic
// field name: "image"
router.post(
    "/me/profile-pic",
    requireAuth,
    uploadUserProfilePic.single("image"),
    asyncHandler(userController.uploadMyProfilePic)
);

// DELETE /api/users/me/profile-pic
router.delete(
    "/me/profile-pic",
    requireAuth,
    asyncHandler(userController.deleteMyProfilePic)
);

export default router;
