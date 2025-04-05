import { Router } from "express";
import authController from "@/api/controllers/auth.controller.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { authenticateToken } from "@/api//middleware/auth.middleware.ts";
import { registerUserSchema, loginUserSchema, resetPasswordSchema, requestPasswordResetSchema } from "@/api/validators/auth.validator.ts";
import { authLimiter } from "@/config/rateLimit.ts";

const router = Router();

router.post("/register", validateRequest(registerUserSchema), authController.register);

router.post("/login", authLimiter, validateRequest(loginUserSchema), authController.login);

router.post("/refresh", authLimiter, authController.refresh);

router.post("/logout", authenticateToken, authController.logout);

router.post("/request-password-reset", authLimiter, validateRequest(requestPasswordResetSchema), authController.handleRequestPasswordReset);

router.post("/reset-password", validateRequest(resetPasswordSchema), authController.handleResetPassword);

export default router;
