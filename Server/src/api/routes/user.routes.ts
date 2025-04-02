import { Router } from "express";
import { UserRole } from "@prisma/client";
import userController from "@/api/controllers/user.controller.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { createUserSchema, updateUserSchema, updateProfileSchema, listUsersSchema, userIdSchema } from "@/api/validators/user.validator.ts";

const router = Router();

/**
 * Defines routes related to user management.
 * Admin routes require ADMIN role.
 * '/me' routes are for the authenticated user.
 */

// --- Admin Only Routes ---

// Protect all subsequent routes in this section with authentication and ADMIN role check
router.use(authenticateToken);

// GET /api/users - List all users (Admin only)
router.get(
    "/",
    authorizeRole([UserRole.ADMIN]), // Only Admins can list all users
    validateRequest(listUsersSchema), // Validate query params
    userController.listUsers,
);

// GET /api/users/:id - Get user by ID (Admin only)
router.get(
    "/:id",
    authorizeRole([UserRole.ADMIN]),
    validateRequest(userIdSchema), // Validate :id param format
    userController.getUserById,
);

// POST /api/users - Create a new user (Admin only)
router.post("/", authorizeRole([UserRole.ADMIN]), validateRequest(createUserSchema), userController.createUser);

// PUT /api/users/:id - Update user by ID (Admin only)
router.put(
    "/:id",
    authorizeRole([UserRole.ADMIN]),
    validateRequest(updateUserSchema), // Validates both params.id and body
    userController.updateUser,
);

// DELETE /api/users/:id - Delete user by ID (Admin only)
router.delete(
    "/:id",
    authorizeRole([UserRole.ADMIN]),
    validateRequest(userIdSchema), // Validate :id param format
    userController.deleteUser,
);

// --- Current User Routes ---
// Note: These routes might appear *after* the admin-only section in execution flow,
// but they are logically separate. The `authenticateToken` middleware applied above
// still protects them. We don't need `authorizeRole` here as any authenticated user can access '/me'.

// GET /api/users/me - Get current user's profile
// IMPORTANT: Define '/me' routes BEFORE '/:id' to avoid '/me' being treated as an ID.
// So, we actually need to define these outside/before the general admin block,
// or structure the router differently. Let's restructure slightly:

const adminRouter = Router(); // Separate router for admin-only user routes
adminRouter.use(authorizeRole([UserRole.ADMIN]));

adminRouter.get("/", validateRequest(listUsersSchema), userController.listUsers);
adminRouter.get("/:id", validateRequest(userIdSchema), userController.getUserById);
adminRouter.post("/", validateRequest(createUserSchema), userController.createUser);
adminRouter.put("/:id", validateRequest(updateUserSchema), userController.updateUser);
adminRouter.delete("/:id", validateRequest(userIdSchema), userController.deleteUser);

// Main User Router
const mainUserRouter = Router();

// Apply authentication to ALL user routes (/me and admin routes)
mainUserRouter.use(authenticateToken);

// '/me' routes - accessible by any authenticated user
mainUserRouter.get("/me", userController.getMyProfile);
mainUserRouter.put("/me", validateRequest(updateProfileSchema), userController.updateMyProfile);

// Mount the admin-only routes under the main user router
// All routes starting with /api/users/ will first hit authenticateToken
mainUserRouter.use("/", adminRouter); // Mount admin routes at the base ('/') relative to mainUserRouter

export default mainUserRouter; // Export the main router
