import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "@/config/swagger.ts";
import env from "@/config/env.ts";
import logger from "@/config/logger.ts";
import morganMiddleware from "@/api/middleware/morgan.middleware.ts";
import appRoutes from "@/api/routes/index.ts";
import { errorHandler } from "@/api/middleware/errorHandler.ts";
import { NotFoundError } from "@/errors/index.ts";

const app: Express = express();
const port = env.PORT;

// === Security middleware ===
app.use(helmet());
app.use(
    cors({
        origin: env.NODE_ENV === "production" ? "https://yourdomain.com" : "http://localhost:5173",
        credentials: true,
    }),
);

// === Requset body parsing ===
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === HTTP request logging
app.use(morganMiddleware);

// --- Application Routes ---
app.get("/", (_req: Request, res: Response) => {
    res.send("Server is up and running");
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ status: "OK", timestamp: new Date() });
});

app.use("/api/v1", appRoutes);

// === Swagger Docs ===
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// === 404 Handler ===
app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Not Found - ${req.originalUrl}`));
});

// --- Central API Error Handler ---
app.use(errorHandler);

// --- Server ---
const server = app.listen(port, () => {
    logger.info(`⚡️[server]: Server is running at http://localhost:${port}`);
});

// --- Graceful shutdown ---
const signals = ["SIGINT", "SIGTERM"];
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds

signals.forEach((signal) => {
    process.on(signal, async () => {
        logger.info(`\nReceived ${signal}, shutting down gracefully...`);

        // Force exit after timeout
        const forceExit = setTimeout(() => {
            logger.error("Could not close connections in time, forcefully shutting down");
            process.exit(1);
        }, SHUTDOWN_TIMEOUT);

        // Close server
        server.close(async () => {
            logger.info("Server closed");

            // Disconnect Prisma client
            try {
                const prisma = (await import("@/config/prisma.ts")).default;
                await prisma.$disconnect();
                logger.info("Prisma client disconnected");
                clearTimeout(forceExit);
                process.exit(0);
            } catch (e) {
                logger.error("Failed to disconnect Prisma client", e);
                clearTimeout(forceExit);
                process.exit(1);
            }
        });
    });
});

export default app;
