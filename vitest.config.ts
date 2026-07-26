import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

// Standalone Vitest config: intentionally omits the wasm/tailwind/node-polyfill
// plugins from vite.config.ts. Two projects split by file extension:
//   - *.test.ts  -> node env (pure logic + decoders that hand Buffers to crypto
//                   libs, which mis-detect Node Buffers under jsdom)
//   - *.test.tsx -> jsdom env with Testing Library setup (component tests)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/lib/dnssec/**",
        "src/components/ui/**",
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Fail the run (and CI) if coverage regresses below these floors.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
