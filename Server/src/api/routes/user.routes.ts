import { Router } from "express";
import { UserRole } from "@prisma/client";
import userController from "@/api/controllers/user.controller.ts";
import { validateRequest } from "@/api/middleware/validateRequest.ts";
import { authenticateToken, authorizeRole } from "@/api/middleware/auth.middleware.ts";
import { createUserSchema, updateUserSchema, updateProfileSchema, listUsersSchema, userIdSchema } from "@/api/validators/user.validator.ts";

const router = Router();

// ALL routes defined in this file will require a valid access token first.
router.use(authenticateToken);

// --- Current User ('/me') Routes ---

/**
 * @swagger
 *  /api/v1/users/me:
 *    get:
 *      summary: Retrieve current user's profile
 *      description: Retrieve the profile of the currently authenticated user.
 *      tags:
 *       - Users
 *      responses:
 *        200:
 *          description: A user object containing their detailed information
 *          content:
 *            application/json:
 *              schema:
 *                $ref: '#/components/schemas/SafeUser'
 *        401:
 *          description: Authorization header missing or invalid format.
 *      security:
 *        - bearerAuth: []
 */
// GET /api/users/me - Get current user's profile
router.get("/me", userController.getMyProfile);

/**
 * @swagger
 *  /api/v1/users/me:
 *   put:
 *     summary: Update current user's profile
 *     description: Update the profile of the currently authenticated user (limited fields).
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfile'
 *     responses:
 *       200:
 *         description: The updated user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       400:
 *        description: Validation failed (body empty/invalid)
 *       401:
 *         description: Authorization header missing or invalid format.
 *       409:
 *        description: Conflict (e.g., email already in use)
 *     security:
 *       - bearerAuth: []
 */
// PUT /api/users/me - Update current user's profile
router.put("/me", validateRequest(updateProfileSchema), userController.updateMyProfile);

// --- Admin Only Routes ---
// All routes below require ADMIN role authorization IN ADDITION to authentication.

/**
 * @swagger
 * /api/v1/users:
 *  get:
 *    summary: List all users (Admin)
 *    description: Retrieve a list of all users in the system.
 *    tags:
 *      - Users
 *    parameters:
 *      - in: query
 *        name: limit
 *        required: false
 *        schema:
 *          type: integer
 *        description: Limits the number of results returned
 *      - in: query
 *        name: page
 *        required: false
 *        schema:
 *          type: integer
 *        description: The page of the results returned
 *    responses:
 *      200:
 *        description: A list of user objects
 *        content:
 *          application/json:
 *            schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/SafeUser'
 *      401:
 *        description: Authorization header missing or invalid format.
 *      403:
 *        description: Forbidden (User is not an Admin)
 *    security:
 *      - bearerAuth: []
 */
// GET /api/users - List all users
router.get("/", authorizeRole([UserRole.ADMIN]), validateRequest(listUsersSchema), userController.listUsers);

/**
 * @swagger
 * /api/v1/users:
 *  post:
 *    summary: Create a new user (Admin)
 *    description: Create a new user in the system (Admin only).
 *    tags:
 *      - Users
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/CreateUser'
 *    responses:
 *      201:
 *        description: The created user object
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/SafeUser'
 *      400:
 *        description: Validation failed (body empty/invalid)
 *      401:
 *        description: Authorization header missing or invalid format.
 *      403:
 *        description: Forbidden (User is not an Admin)
 *      409:
 *        description: Conflict (e.g., email already in use)
 *    security:
 *      - bearerAuth: []
 */
// POST /api/users - Create a new user
router.post("/", authorizeRole([UserRole.ADMIN]), validateRequest(createUserSchema), userController.createUser);

/**
 * @swagger
 *   /api/v1/users/{id}:
 *      get:
 *        summary: Get a user by ID (Admin)
 *        description: Get a user's profile information using their ID
 *        tags:
 *          - Users
 *        parameters:
 *          - in: path
 *            name: id
 *            required: true
 *            schema:
 *              type: string
 *              description: The user's unique ID
 *        responses:
 *          200:
 *            description: A user object
 *            content:
 *              application/json:
 *                schema:
 *                  $ref: '#/components/schemas/SafeUser'
 *          401:
 *            description: Unauthorized.
 *          404:
 *            description: User not found
 *        security:
 *          - bearerAuth: []
 */
// GET /api/users/:id - Get user by ID
router.get("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.getUserById);

/**
 * @swagger
 *  /api/v1/users/me:
 *   put:
 *     summary: Update current user's profile
 *     description: Update the profile of the currently authenticated user (limited fields).
 *     tags:
 *      - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: The updated user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SafeUser'
 *       400:
 *        description: Validation failed (body empty/invalid)
 *       401:
 *         description: Authorization header missing or invalid format.
 *       409:
 *        description: Conflict (e.g., email already in use)
 *     security:
 *       - bearerAuth: []
 */
// PUT /api/users/:id - Update user by ID
router.put("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(updateUserSchema), userController.updateUser);

/**
 * @swagger
 *   /api/users/{id}:
 *     delete:
 *       summary: Delete a user
 *       description: Delete a user's profile
 *       tags:
 *         - Users
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *           description: The user's unique ID
 *       responses:
 *         204:
 *           description: No content
 *       security:
 *         -bearerAuth: []
 */
// DELETE /api/users/:id - Delete user by ID
router.delete("/:id", authorizeRole([UserRole.ADMIN]), validateRequest(userIdSchema), userController.deleteUser);

export default router;
