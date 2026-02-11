import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validateBody";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "../validations/auth.schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
router.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
router.post("/refresh", validateBody(refreshSchema), asyncHandler(authController.refresh));
router.post("/logout", validateBody(logoutSchema), asyncHandler(authController.logout));

export default router;
