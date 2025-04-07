import swaggerJsDoc from "swagger-jsdoc";
import packageJson from "../../package.json" with { type: "json" };

const options: swaggerJsDoc.Options = {
    definition: {
        openapi: "3.0.4",
        info: {
            title: "InvenEase API Documentation",
            version: packageJson.version,
            description: "API documentation for the application",
            contact: {
                name: "InvenEase Team",
                email: "H4Y4o@example.com",
            },
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server",
            },
        ],
        components: {
            schemas: {
                SafeUser: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "The unique identifier for the user", example: "123e4567-e89b-12d3-a456-426655440000" },
                        email: { type: "string", description: "The email address of the user", example: "H4Y4o@example.com" },
                        firstName: { type: "string", description: "The first name of the user", example: "John" },
                        lastName: { type: "string", description: "The last name of the user", example: "Doe" },
                        role: { type: "string", description: "The role of the user", enum: ["ADMIN", "MANAGER", "STAFF"], example: "STAFF" },
                        isActive: { type: "boolean", description: "Whether or not the user is active", example: true },
                        createdAt: {
                            type: "string",
                            format: "date-time",
                            description: "The date and time the user was created",
                            example: "2025-04-05T14:4800.000Z",
                        },
                        updateAt: {
                            type: "string",
                            format: "date-time",
                            description: "The date and time the user was updated",
                            example: "2025-04-05T14:4800.000Z",
                        },
                    },
                },
                Transaction: {
                    type: "object",
                    properties: {
                        productId: { type: "string" },
                        quantityChange: { type: "integer" },
                        type: { type: "string", enum: ["TRANSFER_IN", "TRANSFER_OUT"] },
                        notes: { type: "string" },
                        id: { type: "string" },
                        timestamp: { type: "string", format: "date-time" },
                        userId: { type: "string" },
                        relatedPoId: { type: "string" },
                        relatedSoId: { type: "string" },
                        sourceLocationId: { type: "string" },
                        destinationLocationId: { type: "string" },
                    },
                },
            },
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: ["./src/api/routes/**/*.ts", "./src/api/validators/**/*.ts"],
};

const swaggerDocs = swaggerJsDoc(options);

export default swaggerDocs;
