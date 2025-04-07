import { z } from "zod";
import { UserRole } from "@prisma/client";

const uuidStringSchema = z.string().uuid("Invalid UUID");

// --- Reusable Schemas ---
const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const userIdParamSchema = z.object({
    params: z.object({ id: uuidStringSchema }),
});

// --- Input Schemas ---

/**
 * @swagger
 *   components:
 *     schemas:
 *       CreateUser:
 *         type: object
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: The email address of the user.
 *           password:
 *             type: string
 *             description: The password for the user (required for creation).
 *           firstName:
 *             type: string
 *             description: The first name of the user.
 *           lastName:
 *             type: string
 *             description: The last name of the user.
 *           role:
 *             type: string
 *             enum: [ADMIN, MANAGER, STAFF]
 *             description: The role of the user.
 *           isActive:
 *             type: boolean
 *             description: Whether the user is active or not.
 */
// Schema for Admin creating a user (can set role, status)
export const createUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: passwordSchema, // Password required for creation
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        role: z.nativeEnum(UserRole).default(UserRole.STAFF).optional(), // Default to STAFF if not provided
        isActive: z.boolean().default(true).optional(),
    }),
});
export type CreateUserInput = z.infer<typeof createUserSchema>["body"];

// Schema for updating a user (Admin perspective - can update anything)
/**
 * @swagger
 *   components:
 *     schemas:
 *       UpdateUser:
 *         type: object
 *         properties:
 *           email:
 *             type: string
 *             format: email
 *             description: The email address of the user.
 *           password:
 *             type: string
 *             description: The password for the user (required for creation).
 *           firstName:
 *             type: string
 *             description: The first name of the user.
 *           lastName:
 *             type: string
 *             description: The last name of the user.
 *           role:
 *             type: string
 *             enum: [ADMIN, MANAGER, STAFF]
 *             description: The role of the user.
 *           isActive:
 *             type: boolean
 *             description: Whether the user is active or not.
 */
export const updateUserSchema = z.object({
    params: userIdParamSchema.shape.params, // Validate UUID in URL param
    body: z
        .object({
            email: z.string().email("Invalid email address").optional(),
            // Password is optional for updates
            password: passwordSchema.optional(),
            firstName: z.string().min(1, "First name is required").optional(),
            lastName: z.string().min(1, "Last name is required").optional(),
            role: z.nativeEnum(UserRole).optional(),
            isActive: z.boolean().optional(),
        })
        .strict() // Disallow extra fields in the body
        .refine((data) => Object.keys(data).length > 0, {
            message: "Request body cannot be empty. Please provide fields to update.",
        }), // Ensure at least one field is being updated
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type UpdateUserParams = z.infer<typeof updateUserSchema>["params"];

// Schema for a user updating their own profile (restricted fields)
/**
 * @swagger
 *  conponents:
 *    schemas:
 *      UpdateProfile:
 *        type: object
 *        properties:
 *          password:
 *            type: string
 *            description: User's password
 *          firstName:
 *            type: string
 *            description: User's first name
 *          lastName:
 *            type: string
 *            description: User's last name
 */
export const updateProfileSchema = z.object({
    // No params needed if using a dedicated '/me' route, otherwise check ID match in controller/service
    body: z
        .object({
            // Cannot update email, role, or isActive status through this endpoint
            password: passwordSchema.optional(), // Allow password change
            firstName: z.string().min(1, "First name is required").optional(),
            lastName: z.string().min(1, "Last name is required").optional(),
        })
        .strict()
        .refine((data) => Object.keys(data).length > 0, {
            message: "Request body cannot be empty. Please provide fields to update.",
        }),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];

// Schema for List Users Query Parameters (Pagination, Filtering, Sorting)
export const listUsersSchema = z.object({
    query: z.object({
        page: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default("1")
            .optional()
            .refine((val) => val !== undefined && val >= 1, {
                message: "Page must be 1 or higher",
            }),
        limit: z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .default("10")
            .optional()
            .refine((val) => val !== undefined && val >= 1 && val <= 100, {
                message: "Limit must be between 1 and 100",
            }),
        sortBy: z.enum(["email", "firstName", "lastName", "role", "createdAt", "updatedAt"]).default("createdAt").optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
        role: z.nativeEnum(UserRole).optional(), // Filter by role
        isActive: z
            .enum(["true", "false"])
            .transform((val) => val === "true")
            .optional(), // Filter by active status (convert string)
        search: z.string().trim().toLowerCase().optional(), // Generic search term (email, name)
    }),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];

// Schema just for validating the ID in params (e.g., for GET /users/:id, DELETE /users/:id)
export const userIdSchema = userIdParamSchema;
export type UserIdParams = z.infer<typeof userIdSchema>["params"];
