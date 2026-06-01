import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3050",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    port: 3050,
    reuseExistingServer: true,
    timeout: 180000,
  },
});
