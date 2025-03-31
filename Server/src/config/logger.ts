import pino, { LoggerOptions } from "pino";
import env from "./env";

const developmentOptions: LoggerOptions = {
    level: "debug",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
        },
    },
};

const productionOptions: LoggerOptions = {
    level: "info",
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
};

// Choose options based on environment
const options = env.NODE_ENV === "development" ? developmentOptions : productionOptions;

const logger = pino(options);

process.on("uncaughtException", (err) => {
    logger.fatal(err, "Unhandled exception");
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.fatal({ reason, promise }, "Unhandled rejection");
    process.exit(1);
});

export default logger;
