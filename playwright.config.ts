import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3050",
  },
  webServer: {
    command: "pnpm dev",
    port: 3050,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
