import { defineConfig } from "vitest/config";

// Pure-logic tests only — no DOM needed, so run in the fast node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
