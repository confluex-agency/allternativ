import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run against the LOCAL MariaDB from docker-compose, not a mock.
//
// The thing worth testing here is the path the money takes, and that path is
// almost entirely database behaviour: a reservation is consumed, stock comes
// down, a case comes out of its own pool, costs are frozen, and the same event
// arriving twice must not produce two orders. Mocking Prisma would test the
// mock. So the tests use the real schema, create their own fixtures, and clean
// up after themselves.
//
// Single-threaded on purpose: several suites writing to one database at once
// would fail for reasons that have nothing to do with the code.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The same way every script in this repo reads .env.
    setupFiles: ["dotenv/config"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
