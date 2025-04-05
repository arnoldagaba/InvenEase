import swaggerJsDoc from "swagger-jsdoc";
import packageJson from "../../package.json" with { type: "json" };

const options: swaggerJsDoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Documentation",
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
                // --- User related schemas
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
    apis: ["./src/api/routes/**/*.ts"],
};

const swaggerDocs = swaggerJsDoc(options);

export default swaggerDocs;
