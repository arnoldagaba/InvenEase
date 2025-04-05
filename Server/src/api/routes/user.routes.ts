import { Router } from "express";
import { UserRole } from "@prisma/client";
import userController from "@/api/controllers/user.controller.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { createUserSchema, updateUserSchema, updateProfileSchema, listUsersSchema, userIdSchema } from "@/api/validators/user.validator.ts"; // Ensure path is correct

const router = Router();

// ALL routes defined in this file will require a valid access token first.
router.use(authenticateToken);

// --- Current User ('/me') Routes ---

// GET /api/users/me - Get current user's profile
router.get("/me", userController.getMyProfile);

// PUT /api/users/me - Update current user's profile
router.put("/me", validateRequest(updateProfileSchema), userController.updateMyProfile);

// --- Admin Only Routes ---
// All routes below require ADMIN role authorization IN ADDITION to authentication.

// GET /api/users - List all users
router.get("/", authorizeRole([UserRole.ADMIN]), validateRequest(listUsersSchema), userController.listUsers);

// POST /api/users - Create a new user
router.post("/", authorizeRole([UserRole.ADMIN]), validateRequest(createUserSchema), userController.createUser);

// GET /api/users/:id - Get user by ID
router.get("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.getUserById);

// PUT /api/users/:id - Update user by ID
router.put("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(updateUserSchema), userController.updateUser);

// DELETE /api/users/:id - Delete user by ID
router.delete("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.deleteUser);

export default router;
