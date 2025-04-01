import { PrismaClient } from "@prisma/client";
import logger from "./logger.ts";
import env from "./env.ts";

// Define Prisma log levels you want to capture
type PrismaLogLevel = "info" | "query" | "warn" | "error";
const prismaLogLevels: PrismaLogLevel[] = ["query", "info", "warn", "error"];

// Function to map Prisma levels to Winston levels
const mapPrismaLevelToWinston = (level: PrismaLogLevel): string => {
    switch (level) {
        case "query":
            return "debug"; // Log queries as debug level
        case "info":
            return "info";
        case "warn":
            return "warn";
        case "error":
            return "error";
        default:
            return "info";
    }
};

const prisma = new PrismaClient({
    log: prismaLogLevels.map((level) => ({
        emit: "event" as const, // Use 'stdout' to log directly to console, 'event' to handle programmatically
        level: level,
    })),

    // Optional: Enable error formatting for better stack traces
    errorFormat: env.NODE_ENV === "development" ? "pretty" : "minimal",
});

// Listen for Prisma's log events
prismaLogLevels.forEach((level) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.$on(level, (e: any) => {
        const winstonLevel = mapPrismaLevelToWinston(level);
        let message = e.message || ""; // Default message

        // Customize message formatting based on event type
        if (level === "query") {
            // Avoid logging sensitive data in params if necessary
            // Consider redacting sensitive fields in production
            message = `Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`;
        } else if (e.target) {
            // For info, warn, error which might have a target
            message = `Target: ${e.target} | Message: ${e.message}`;
        }

        logger.log(winstonLevel, `[Prisma] ${message}`, { timestamp: e.timestamp });
    });
});

logger.info("Prisma Client initialized with logging configured.");

export default prisma;
