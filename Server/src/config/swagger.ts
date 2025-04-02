import swaggerJsdoc from "swagger-jsdoc";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import env from "./env.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Inventory Management API",
            version: "1.0.0",
            description: "API documentation for the Inventory Management System",
            contact: {
                // Optional
                name: "API Support",
                // url: 'http://www.example.com/support',
                // email: 'support@example.com',
            },
        },
        servers: [
            {
                url: `http://localhost:${env.PORT || 3001}/api`,
                description: "Development server",
            },
            // Add more servers (staging, production) if needed
        ],
        components: {
            // Define security schemes (JWT)
            securitySchemes: {
                bearerAuth: {
                    // Name matches the security key in route definitions
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                // If using refresh token cookie, document it separately if needed,
                // but typically bearerAuth covers the access token aspect.
            },
            // We will define reusable schemas here later
            schemas: {
                ApiError: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "error" },
                        statusCode: { type: "integer" },
                        message: { type: "string" },
                        errors: { type: "array", items: { type: "object" } },
                    },
                    required: ["status", "statusCode", "message"],
                },

                // --- User Related Schemas ---
                UserInput: {
                    // Base for creation/update
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email", example: "user@example.com" },
                        firstName: { type: "string", example: "John" },
                        lastName: { type: "string", example: "Doe" },
                        // Don't include password or role for general input usually
                    },
                },
                SafeUser: {
                    // User data returned (excluding sensitive fields)
                    type: "object",
                    properties: {
                        id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-1234-567890abcdef" },
                        email: { type: "string", format: "email", example: "user@example.com" },
                        firstName: { type: "string", example: "John" },
                        lastName: { type: "string", example: "Doe" },
                        role: { type: "string", enum: ["ADMIN", "MANAGER", "STAFF"], example: "STAFF" },
                        isActive: { type: "boolean", example: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                    },
                    required: ["id", "email", "role", "isActive", "createdAt", "updatedAt"],
                },

                // --- Auth Specific Schemas ---
                RegisterUserInput: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email", example: "newuser@example.com" },
                        password: { type: "string", format: "password", example: "password123", minLength: 8 },
                        firstName: { type: "string", example: "Jane" },
                        lastName: { type: "string", example: "Smith" },
                    },
                    required: ["email", "password"],
                },
                LoginUserInput: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email", example: "user@example.com" },
                        password: { type: "string", format: "password", example: "password123" },
                    },
                    required: ["email", "password"],
                },
                LoginResponse: {
                    type: "object",
                    properties: {
                        accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsIn..." },
                        user: { $ref: "#/components/schemas/SafeUser" }, // Reference SafeUser schema
                    },
                    required: ["accessToken", "user"],
                },
                RefreshResponse: {
                    type: "object",
                    properties: {
                        accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsIn..." },
                    },
                    required: ["accessToken"],
                },
                LogoutResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Logout successful" },
                    },
                    required: ["message"],
                },
                // --- Password Reset Schemas ---
                RequestPasswordResetInput: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email", example: "user@example.com" },
                    },
                    required: ["email"],
                },
                RequestPasswordResetResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "If an account with that email exists, a password reset link has been sent." },
                    },
                    required: ["message"],
                },
                ResetPasswordInput: {
                    type: "object",
                    properties: {
                        token: { type: "string", example: "a1b2c3d4e5f6..." }, // Example reset token
                        newPassword: { type: "string", format: "password", example: "newSecurePassword123", minLength: 8 },
                    },
                    required: ["token", "newPassword"],
                },
                ResetPasswordResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string", example: "Password has been reset successfully." },
                    },
                    required: ["message"],
                },
            },
        },
        // Default security applied to all paths unless overridden
        // security: [
        //     {
        //         bearerAuth: [], // Requires bearerAuth for all paths by default
        //     },
        // ],
    },
    // Path to the API docs files (routes, controllers where you'll put JSDoc comments)
    apis: [
        path.join(__dirname, "../api/routes/*.routes.ts"),
        path.join(__dirname, "../api/validators/*.validator.ts"),
        path.join(__dirname, "../api/controllers/*.controller.ts"),
    ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
