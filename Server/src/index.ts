import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import { pinoHttp } from "pino-http";
import pino from "pino";
import { randomUUID } from "crypto";
import env from "@/config/env";
import logger from "@/config/logger";

const app: Express = express();
const port = env.PORT;

// --- Logger ---
app.use(
    pinoHttp({
        logger: logger,

        // Define a custom request ID generator
        genReqId: (req: Request, res: Response) => {
            const existingId = req.id ?? req.headers["x-request-id"];
            if (existingId) return existingId;

            const id = randomUUID();
            res.setHeader("x-request-id", id); // Set header on response for client correlation
            return id;
        },

        // Define custom serializers
        serializers: {
            // Standard serializers are usually good enough
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err, // Default, logs error properties + stack
        },

        // Customize log level for particular status codes
        customLogLevel: function (_req: Request, res: Response, err: Error) {
            if (res.statusCode >= 400 && res.statusCode < 500) {
                return "warn"; // Log client errors as warnings
            } else if (res.statusCode >= 500 || err) {
                return "error"; // Log server errors and uncaught exceptions as errors
            } else if (res.statusCode >= 300 && res.statusCode < 400) {
                return "silent"; // Don't log redirects by default
            }
            return "info"; // Default log level for success responses
        },

        // Customize success messages
        customSuccessMessage: function (req: Request, res: Response, responseTime: number) {
            // Don't log successful OPTIONS requests or common health checks (if desired)
            if (req.method === "OPTIONS" || req.url === "/health") {
                return ""; // Return empty string to skip logging
            }
            return `${req.method} ${req.url} completed ${res.statusCode} in ${responseTime}ms`;
        },

        // Customize error messages
        customErrorMessage: function (req: Request, res: Response, err: Error, responseTime: number) {
            return `${req.method} ${req.url} errored ${res.statusCode} in ${responseTime}ms: ${err.message}`;
        },
    }),
);

// --- Core middleware ---
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.get("/", (_req: Request, res: Response) => {
    res.send("Server is up and running");
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ status: "OK", timestamp: new Date() });
});

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
        logger.flush();

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
                const prisma = (await import("@/config/prisma")).default;
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
