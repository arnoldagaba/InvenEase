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
// Define these BEFORE routes with parameters like '/:id' to ensure '/me' isn't treated as an ID.
// Any authenticated user can access these. No specific role authorization needed here.

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/users/me - Get current user's profile
router.get("/me", userController.getMyProfile);

/**
 * @openapi
 * /api/users/me:
 *   put:
 *     summary: Update current user's profile
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileInput'
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// PUT /api/users/me - Update current user's profile
router.put("/me", validateRequest(updateProfileSchema), userController.updateMyProfile);

// --- Admin Only Routes ---
// All routes below require ADMIN role authorization IN ADDITION to authentication.

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List all users
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Optional search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *         description: Number of users to return (default 10)
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *         default: 0
 *         description: Number of users to skip (default 0)
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SafeUser'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/users - List all users
router.get("/", authorizeRole([UserRole.ADMIN]), validateRequest(listUsersSchema), userController.listUsers);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// POST /api/users - Create a new user
router.post("/", authorizeRole([UserRole.ADMIN]), validateRequest(createUserSchema), userController.createUser);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /api/users/:id - Get user by ID
router.get("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.getUserById);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// PUT /api/users/:id - Update user by ID
router.put("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(updateUserSchema), userController.updateUser);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized (no access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * */
// DELETE /api/users/:id - Delete user by ID
router.delete("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.deleteUser);

export default router;
