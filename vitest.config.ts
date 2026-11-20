import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure modules (lib/**). Next.js isn't involved: these run in plain Node.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
});
