import { z } from "zod";
import { UserRole } from "@prisma/client";

// Base schema for fields used in multiple places
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long");

export const registerUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: passwordSchema,
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        // Role is usually assigned by admin or defaults, not provided during self-registration
    }),
});
export type RegisterUserInput = z.infer<typeof registerUserSchema>["body"];

export const loginUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"), // Basic check, complexity checked elsewhere
    }),
});
export type LoginUserInput = z.infer<typeof loginUserSchema>["body"];

// For refresh token, we typically check for the cookie's existence in the controller/middleware
// No specific schema needed for the request body usually.

export const requestPasswordResetSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
    }),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>["body"];

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Reset token is required"), // The token from the email link/user input
        newPassword: passwordSchema,
    }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];

// Optional: Schema for when an admin creates/updates a user (might include role)
export const adminCreateUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: passwordSchema,
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        role: z.nativeEnum(UserRole).optional(), // Allow setting role
        isActive: z.boolean().optional(),
    }),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>["body"];
