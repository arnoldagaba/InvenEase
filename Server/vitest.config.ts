import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()], // Add the plugin to handle tsconfig paths like @/*
    test: {
        globals: true, // Use Vitest globals (describe, it, expect, etc.) without importing
        environment: "node", // Specify the test environment (Node.js for backend)
        setupFiles: ["./tests/vitest.setup.ts"], // Path to your global setup file
        hookTimeout: 70000, // Optional: Increase timeout for hooks if needed
        // Optional: Configure coverage
        coverage: {
            provider: "v8", // or 'istanbul'
            reporter: ["text", "json", "html"], // Output formats
            reportsDirectory: "./coverage", // Where to output coverage reports
            include: ["src/**/*.ts"], // Files to include in coverage
            exclude: [
                // Files/patterns to exclude
                "src/index.ts",
                "src/app.ts", // Exclude main entry points usually
                "src/config/**",
                "src/errors/**", // Exclude simple error classes if desired
                "src/middleware/errorHandler.ts", // Error handler logic can be tricky to cover fully
                "src/api/validators/**", // Zod schemas often don't need coverage reports
                "**/*.d.ts", // Type definition files
                "**/*.test.ts", // Test files themselves
                "**/seed.ts", // Seed scripts
                "vitest.setup.ts",
                "vitest.config.ts",
            ],
            // Optional: Set thresholds (example)
            // thresholds: {
            //     lines: 80,
            //     functions: 80,
            //     branches: 80,
            //     statements: 80,
            // },
        },
        // Optional: Increase default test timeout if needed (e.g., for DB operations)
        // testTimeout: 10000, // 10 seconds
    },
});
