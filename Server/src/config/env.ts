interface Environment {
    PORT: number;
    NODE_ENV: string;
    DATABASE_URL: string;
    LOG_DIR: string;
    LOG_LEVEL: string;
    LOG_TO_FILES: boolean;
}

const env: Environment = {
    PORT: parseInt(process.env.PORT ?? "3001", 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    LOG_DIR: process.env.LOG_DIR ?? "",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
    LOG_TO_FILES: process.env.LOG_TO_FILES === "true",
};

// Validate essential variables
if (!env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL is not defined in .env file");
    process.exit(1);
}
if (!env.LOG_DIR) {
    console.error("FATAL ERROR: LOG_DIR is not defined in .env file");
    process.exit(1);
}

export default env;
