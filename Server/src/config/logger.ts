import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import env from "./env.ts";

// Define log levels and colors
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3, // Morgan logs will use this level
    debug: 4,
};

const level = (): string => {
    const environment = env.NODE_ENV || "development";
    const isDevelopment = environment === "development";
    return isDevelopment ? "debug" : "http"; // Log more in dev, less in prod by default
};

const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};

winston.addColors(colors);

// Define the log format
const createLogFormat = (isJson = false) => {
    const { combine, timestamp, printf, errors, json, colorize, splat } = winston.format;

    const errorStackFormat = errors({ stack: true }); // Log stack trace for errors

    if (isJson) {
        return combine(timestamp(), errorStackFormat, splat(), json());
    }

    // Human-readable format for console/dev
    return combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        colorize({ all: true }), // Colorize the entire log message
        errorStackFormat,
        splat(),
        printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}` + (info.stack ? `\n${info.stack}` : "")),
    );
};

// Determine log directory
const logDir = env.LOG_DIR || path.join(__dirname, "../../logs"); // Store logs in a 'logs' directory at the project root

// Define transports based on environment
const transports: winston.transport[] = [
    // Console transport - always active, uses human-readable format
    new winston.transports.Console({
        format: createLogFormat(false), // Non-JSON for console readability
        level: level(), // Log level based on environment
        handleExceptions: true, // Handle uncaught exceptions
    }),
];

// File transports - active only in production (or if explicitly configured)
if (process.env.NODE_ENV === "production" || process.env.LOG_TO_FILES === "true") {
    transports.push(
        // Combined logs file transport
        new winston.transports.DailyRotateFile({
            level: "http", // Log http and above to this file
            filename: path.join(logDir, "combined-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true, // Compress old log files
            maxSize: "20m", // Rotate log file when it exceeds 20MB
            maxFiles: "14d", // Retain logs for 14 days
            format: createLogFormat(true), // Use JSON format for file logs
            handleExceptions: true,
        }),

        // Error logs file transport
        new winston.transports.DailyRotateFile({
            level: "error", // Log only errors to this file
            filename: path.join(logDir, "error-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "30d", // Retain error logs longer
            format: createLogFormat(true), // Use JSON format for file logs
            handleExceptions: true, // Handle uncaught exceptions here too
        }),
    );
}

// Create the Winston logger instance
const logger = winston.createLogger({
    level: level(),
    levels,
    format: createLogFormat(), // Default format (will be overridden by transports)
    transports,
    exitOnError: false, // Do not exit on handled exceptions
});

// Handle Uncaught Rejections (Promises) - Log them and optionally exit
process.on("unhandledRejection", <T>(reason: Error | T, promise: Promise<T>) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${(reason as Error).stack || reason}`);

    // Optional: Exit process in production for unhandled rejections, might be safer to let it crash and restart
    if (process.env.NODE_ENV === "production") {
        process.exit(1);
    }
});

// Handle Uncaught Exceptions - Log them and exit gracefully
process.on("uncaughtException", (error: Error) => {
    logger.error(`Uncaught Exception: ${error.stack || error}`);
    // It's generally recommended to exit gracefully after an uncaught exception
    // as the application state might be corrupted.
    // Give Winston some time to write the log before exiting.
    setTimeout(() => process.exit(1), 1000); // Wait 1 sec
});

export default logger;
