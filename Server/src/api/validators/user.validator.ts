import { z } from "zod";
import { UserRole } from "@prisma/client";

// --- Reusable Schemas ---
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long");
const userIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid user ID format"), // Ensure UUID format
    }),
});

// --- Input Schemas ---

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
        page: z.string().regex(/^\d+$/).transform(Number).default("1").optional(), // String from query, convert to number
        limit: z.string().regex(/^\d+$/).transform(Number).default("10").optional(),
        sortBy: z.enum(["email", "firstName", "lastName", "role", "createdAt", "updatedAt"]).default("createdAt").optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
        role: z.nativeEnum(UserRole).optional(), // Filter by role
        isActive: z
            .enum(["true", "false"])
            .transform((val) => val === "true")
            .optional(), // Filter by active status (convert string)
        search: z.string().optional(), // Generic search term (email, name)
    }),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>["query"];

// Schema just for validating the ID in params (e.g., for GET /users/:id, DELETE /users/:id)
export const userIdSchema = userIdParamSchema;
export type UserIdParams = z.infer<typeof userIdSchema>["params"];
