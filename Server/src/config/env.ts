interface Environment {
    PORT: number;
    NODE_ENV: string;
    DATABASE_URL: string;
}

const env: Environment = {
    PORT: parseInt(process.env.PORT ?? "3001", 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
};

// Validate essential variables
if (!env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL is not defined in .env file");
    process.exit(1);
}

export default env;
