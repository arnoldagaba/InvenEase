import winston from "winston";
import "winston-daily-rotate-file";

/** Custom format to properly cature error stack trace if an error is passed */
const errorFormat = winston.format((info) => {
    if (info instanceof Error) {
        return Object.assign({}, info, {
            message: info.message,
            stack: info.stack,
        });
    }
    return info;
});

const logFormat = winston.format.printf(
    ({ timestamp, level, message, stack }) => {
        return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ""}`;
    }
);

const errorRotateTransport = new winston.transports.DailyRotateFile({
    filename: "logs/%DATE%-error.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    level: "error",
    maxSize: "20m",
    maxFiles: "14d",
});

const combinedRotateTransport = new winston.transports.DailyRotateFile({
    filename: "logs/%DATE%-combined.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === "development" ? "debug" : "info",
    format: winston.format.combine(
        errorFormat(),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        process.env.NODE_ENV === "development"
            ? winston.format.combine(winston.format.colorize(), logFormat)
            : logFormat
    ),
    transports: [
        new winston.transports.Console(),
        combinedRotateTransport,
        errorRotateTransport,
    ],
    exitOnError: false,
});

export default logger;
