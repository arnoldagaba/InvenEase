import morgan, { StreamOptions } from "morgan";
import logger from "@/config/logger.ts";
import env from "@/config/env.ts";

// Define the Morgan stream
const stream: StreamOptions = {
    write: (message) => logger.http(message.trim()),
};

// Define Morgan format based on environment
const morganFormat = env.NODE_ENV === "production" ? "combined" : "dev";

// Build the Morgan middleware
const morganMiddleware = morgan(
    morganFormat, // Use the determined format
    {
        stream, // Pipe output to Winston stream
    },
);

export default morganMiddleware;
