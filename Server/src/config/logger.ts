import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import os from "os";
import env from "@/config/env.ts";

// Define a type for our environment configuration
interface EnvConfig {
    NODE_ENV: "development" | "production";
    LOG_DIR?: string;
    LOG_TO_FILES?: boolean;
}

// Create a typed configuration object from environment variables
const config: EnvConfig = {
    NODE_ENV: (env.NODE_ENV as "development" | "production") || "development",
    LOG_DIR: env.LOG_DIR || path.join(__dirname, "./logs"),
    LOG_TO_FILES: env.LOG_TO_FILES,
};

// Define log levels and colors
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3, // For HTTP logs (e.g., Morgan)
    debug: 4,
};

const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};

winston.addColors(colors);

/**
 * Create the log format.
 * @param isJson - When true, outputs logs in JSON format (useful for file logs).
 */
const createLogFormat = (isJson = false) => {
    const { combine, timestamp, printf, errors, json, colorize, splat } = winston.format;
    const errorStackFormat = errors({ stack: true }); // Includes stack traces for errors

    if (isJson) {
        return combine(timestamp(), errorStackFormat, splat(), json());
    }

    // Human-readable format for console output
    return combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        colorize({ all: true }),
        errorStackFormat,
        splat(),
        printf((info) => {
            // Optionally include additional meta information if available
            const meta = info.meta ? JSON.stringify(info.meta) : "";
            return `[${info.timestamp}] ${info.level}: ${info.message} ${meta}` + (info.stack ? `\n${info.stack}` : "");
        }),
    );
};

/**
 * Creates and returns the list of Winston transports based on the environment.
 */
const getTransports = (): winston.transport[] => {
    const transports: winston.transport[] = [
        // Console transport: always active with human-readable format
        new winston.transports.Console({
            format: createLogFormat(false),
            level: config.NODE_ENV === "development" ? "debug" : "http",
            handleExceptions: true,
        }),
    ];

    // Add file transports for production or if explicitly enabled
    if (config.NODE_ENV === "production" || config.LOG_TO_FILES) {
        transports.push(
            // Combined logs file transport (HTTP and above)
            new winston.transports.DailyRotateFile({
                level: "http",
                filename: path.join(config.LOG_DIR!, "combined-%DATE%.log"),
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "14d",
                format: createLogFormat(true),
                handleExceptions: true,
            }),
            // Error logs file transport
            new winston.transports.DailyRotateFile({
                level: "error",
                filename: path.join(config.LOG_DIR!, "error-%DATE%.log"),
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "30d",
                format: createLogFormat(true),
                handleExceptions: true,
            }),
        );
    }

    return transports;
};

// Create the Winston logger instance
const logger = winston.createLogger({
    level: config.NODE_ENV === "development" ? "debug" : "http",
    levels,
    format: createLogFormat(), // Base format (each transport may override this)
    transports: getTransports(),
    exitOnError: false,
    // Default metadata added to every log
    defaultMeta: { hostname: os.hostname(), pid: process.pid },
});

/**
 * Gracefully shuts down the application after flushing logs.
 */
const gracefulShutdown = () => {
    logger.info("Shutting down gracefully...");
    // Allow time for pending log writes to complete
    setTimeout(() => process.exit(1), 1000);
};

// Handle unhandled promise rejections
process.on("unhandledRejection", <T>(reason: Error | T, promise: Promise<T>) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${(reason as Error).stack || reason}`);
    if (config.NODE_ENV === "production") {
        gracefulShutdown();
    }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
    logger.error(`Uncaught Exception: ${error.stack || error}`);
    gracefulShutdown();
});

// Handle termination signals for graceful shutdown
process.on("SIGTERM", () => {
    logger.info("Received SIGTERM");
    gracefulShutdown();
});

process.on("SIGINT", () => {
    logger.info("Received SIGINT");
    gracefulShutdown();
});

export default logger;
