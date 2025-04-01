import pino from "pino";
import dayjs from "dayjs";
import os from "os";
import env from "./env";

const isProduction = env.NODE_ENV === "production";
const defaultLogLevel = isProduction ? "info" : "debug";

// Define transport based on environment
const transport = pino.transport({
    targets: [
        // Target 1: Pretty print to console in development
        ...(!isProduction
            ? [
                  {
                      target: "pino-pretty",
                      level: process.env.LOG_LEVEL || defaultLogLevel,
                      options: {
                          colorize: true,
                          levelFirst: true,
                          translateTime: `SYS:standard`,
                          ignore: "pid,hostname", // Exclude noisy fields
                      },
                  },
              ]
            : []),

        // Target 2: Output JSON to stdout in production (or configure file/service transport)
        ...(isProduction
            ? [
                  {
                      target: "pino/stdout", // Pino's built-in stdout transport
                      level: process.env.LOG_LEVEL || defaultLogLevel,
                      options: {
                          // Production-specific options if needed
                          destination: "/var/log/myapp.log", // Example: Log to a file instead/as well
                      },
                  },
              ]
            : []),

        // Add more targets here if needed (e.g., log service transport)
    ],
});

const logger = pino(
    {
        level: process.env.LOG_LEVEL || defaultLogLevel,
        timestamp: () => `,"time":"${dayjs().format()}"`,
        // Base properties included in all logs (optional)
        base: {
            pid: process.pid, // Default is included, uncomment if explicitly needed elsewhere
            hostname: os.hostname(), // Default is included
            service: process.env.SERVICE_NAME || "my-backend-service", // Example service name
        },
        // Redact sensitive information
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.secret",
                "req.body.apiKey",
                "*.password",
                "*.secret",
                "*.apiKey",
            ],
            censor: "[REDACTED]",
            remove: false, // Set true to remove the key-value pair entirely
        },
        // Formatters (optional advanced customization)
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            },
            bindings: (bindings) => {
                // Customize pid, hostname etc. if needed
                return { pid: bindings.pid, host: bindings.hostname };
            },
        },
    },
    // Use the configured transport only if it has targets
    transport?.targets?.length ? transport : undefined,
);

export default logger;
