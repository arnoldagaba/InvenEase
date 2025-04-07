import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import swaggerUi from "swagger-ui-express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import swaggerSpec from "@/config/swagger.ts";
import env from "@/config/env.ts";
import logger from "@/config/logger.ts";
import morganMiddleware from "@/api/middleware/morgan.middleware.ts";
import appRoutes from "@/api/routes/index.ts";
import { errorHandler } from "@/api/middleware/errorHandler.ts";
import { NotFoundError } from "@/errors/index.ts";
import { AuthenticatedSocket } from "@/api/middleware/socket.middleware.ts";
import { generalLimiter } from "@/config/rateLimit.ts";

const app: Express = express();
const port = env.PORT;

// --- Create HTTP Server from Express App ---
const httpServer = http.createServer(app);

// --- Configure CORS (ensure allowed origins match frontend and potentially socket client) ---
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [];
logger.info(`Configuring CORS for origins: ${allowedOrigins.join(", ")}`);

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests) or from whitelisted origins
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            callback(null, true);
        } else {
            logger.warn(`CORS: Blocked origin ${origin}`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true, // Important for cookies (like refresh token)
};

// --- Initialize Socket.IO Server ---
export const io = new SocketIOServer(httpServer, {
    cors: corsOptions, // Apply same CORS options to Socket.IO
    serveClient: false, // We don't need Socket.IO to serve the client library
    // Consider adding path, transports, etc. if needed
    // path: '/my-custom-path/'
    transports: ["websocket", "polling"], // Default transports
});

// === Security middleware ===
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudfare.com"],
                "connect-src": ["'self'", "http://localhost:3000", "http://127.0.0.1:3000"],
                "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            },
        },
    }),
);
app.use(cors(/* corsOptions */));

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

// Rate-limit
app.use(generalLimiter);

// Mounted routes
app.use("/api/v1", appRoutes);

// === Swagger Docs ===
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// === 404 Handler ===
app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Not Found - ${req.originalUrl}`));
});

// --- Central API Error Handler ---
app.use(errorHandler);

// --- Socket.IO Connection Logic ---
io.on("connection", (socket: AuthenticatedSocket) => {
    if (!socket.data.user) {
        logger.warn(`Socket ${socket.id} connected but missing authenticated user data.`);
        socket.disconnect(true); // Disconnect if auth somehow failed but middleware allowed connection
        return;
    }

    const userId = socket.data.user.userId;
    logger.info(`User ${userId} connected via socket ${socket.id}`);

    // Join the user to a room identified by their userId
    // This allows targeting events specifically to that user across multiple connections/tabs
    socket.join(userId);
    logger.debug(`Socket ${socket.id} joined room ${userId}`);

    // Handle disconnect
    socket.on("disconnect", (reason) => {
        logger.info(`User ${userId} disconnected from socket ${socket.id}. Reason: ${reason}`);
        // No need to explicitly leave the room, Socket.IO handles it on disconnect
    });

    // Example: Listening for a specific client event (optional)
    socket.on("client_event_example", (data) => {
        logger.debug(`Received 'client_event_example' from user ${userId}:`, data);
        // Can emit back to sender or broadcast etc.
        socket.emit("server_response", { received: data });
    });
});

// --- Server ---
const server = httpServer.listen(port, () => {
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
