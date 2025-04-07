import { beforeAll, afterAll, vi } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

console.log("🚀 Loading test environment variables...");
// Load environment variables from .env.test
dotenv.config({ path: path.resolve(__dirname, ".env.test") });
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - DATABASE_URL (masked): ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, "://****:****@")}`);

// Instantiate a Prisma client instance specifically for setup/teardown if needed
// Usually, the singleton imported in your code will pick up the test DATABASE_URL
const prisma = new PrismaClient();

beforeAll(async () => {
    console.log("🚀 Running global test setup (beforeAll)...");

    // --- Ensure Test Database Schema is Up-to-Date ---
    console.log("   - Applying Prisma migrations to test database...");
    try {
        // Ensure DATABASE_URL from .env.test is used by Prisma CLI commands
        // Using execSync - requires Prisma CLI to be accessible
        execSync("npx prisma migrate deploy", {
            env: { ...process.env }, // Pass current process env vars
            stdio: "inherit", // Show migration output
        });
        console.log("   - Prisma migrations applied successfully.");
    } catch (error) {
        console.error("❌ Failed to apply Prisma migrations:", error);
        // Decide if tests should proceed without migrations - likely not.
        process.exit(1);
    }

    // --- Optional: Reset Database State Before Suite ---
    // This ensures a clean slate before *any* tests run.
    // You might prefer resetting *before each* test instead (see test file examples).
    console.log("   - Resetting test database state...");
    try {
        // MySQL specific truncate (example - adjust table names and logic)
        // IMPORTANT: This assumes tables exist from migrations. Adapt for your schema.
        const tablesResult = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT LIKE '_prisma_migrations';`,
        );
        const tables = tablesResult.map((t) => `\`${t.TABLE_NAME}\``); // Quote table names

        if (tables.length > 0) {
            await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");
            for (const table of tables) {
                console.log(`     - Truncating ${table}...`);
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table};`);
            }
            await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
            console.log("   - Test database reset complete.");
        } else {
            console.log("   - No user tables found to reset.");
        }

        // Optional: Run seed script after reset if needed for all tests
        console.log("   - Running test database seed...");
        execSync("npx prisma db seed", { env: { ...process.env }, stdio: "inherit" }); // Ensure seed script uses test DB!
        // console.log('   - Test database seeded.');
    } catch (error) {
        console.error("❌ Failed to reset test database:", error);
        process.exit(1);
    }

    // --- Any other global setup ---
    // e.g., Mock global dependencies like Date or external services
    vi.useFakeTimers();

    console.log("✅ Global test setup finished.");
});

afterAll(async () => {
    console.log("🚀 Running global test teardown (afterAll)...");
    // Clean up resources
    vi.useRealTimers(); // Restore real timers if faked

    // Disconnect Prisma client used in setup (if any)
    await prisma.$disconnect();
    console.log("   - Prisma client disconnected.");
    console.log("✅ Global test teardown finished.");
});
