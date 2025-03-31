import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import { pinoHttp } from "pino-http";
import pino from "pino";
import env from "@/config/env";
import logger from "@/config/logger";

const app: Express = express();
const port = env.PORT;

// --- Logger ---
app.use(
    pinoHttp({
        logger: logger,
        serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err,
        },
        customSuccessMessage: (_req: Request, res: Response, responseTime: number) =>
            res.statusCode === 404 ? "Resource not found" : `Request successful in ${responseTime}ms`,
        customErrorMessage: (req: Request, res: Response) => {
            return `${req.method} ${req.url} ${res.statusCode}`;
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
