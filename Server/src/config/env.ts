interface Environment {
    PORT: number;
    NODE_ENV: string;
    DATABASE_URL: string;
    LOG_DIR: string;
    LOG_LEVEL: string;
    LOG_TO_FILES: boolean;
    EMAIL_HOST: string;
    EMAIL_PORT: number;
    EMAIL_USER: string;
    EMAIL_PASS: string;
    EMAIL_FROM: string;
    CLIENT_URL: string;
}

const env: Environment = {
    PORT: parseInt(process.env.PORT ?? "3001", 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    LOG_DIR: process.env.LOG_DIR ?? "",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
    LOG_TO_FILES: process.env.LOG_TO_FILES === "true",
    EMAIL_HOST: process.env.EMAIL_HOST ?? "",
    EMAIL_PORT: parseInt(process.env.EMAIL_PORT ?? "587", 10),
    EMAIL_USER: process.env.EMAIL_USER ?? "",
    EMAIL_PASS: process.env.EMAIL_PASS ?? "",
    EMAIL_FROM: process.env.EMAIL_FROM ?? "",
    CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:5174",
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
if (!env.EMAIL_HOST) {
    console.error("FATAL ERROR: EMAIL_HOST is not defined in .env file");
    process.exit(1);
}
if (!env.EMAIL_USER) {
    console.error("FATAL ERROR: EMAIL_USER is not defined in .env file");
    process.exit(1);
}
if (!env.EMAIL_PASS) {
    console.error("FATAL ERROR: EMAIL_PASS is not defined in .env file");
    process.exit(1);
}
if (!env.EMAIL_FROM) {
    console.error("FATAL ERROR: EMAIL_FROM is not defined in .env file");
    process.exit(1);
}

export default env;
