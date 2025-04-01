import swaggerJsdoc from "swagger-jsdoc";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

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
                url: `http://localhost:${process.env.PORT || 3001}/api`, // Adjust if your base path differs
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
                // Example Error Schema (can be reused in responses)
                ApiError: {
                    type: "object",
                    properties: {
                        status: { type: "string", example: "error" },
                        statusCode: { type: "integer", example: 400 },
                        message: { type: "string", example: "Specific error message" },
                        errors: {
                            type: "array", // Optional: for validation errors
                            items: {
                                type: "object",
                                // Define structure of Zod error details if desired
                            },
                        },
                    },
                    required: ["status", "statusCode", "message"],
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
        path.join(__dirname, "../routes/*.routes.ts"),
        path.join(__dirname, "../schemas/*.validator.ts"), // Include schemas for component definitions
    ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
