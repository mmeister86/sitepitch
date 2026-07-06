import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "convex/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/lib/**/*.test.ts", "convex/schema.contract.test.ts"],
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
})
