import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["reading-polish.spec.ts", "offline.spec.ts"],
  outputDir: "test-results/dev-audit",
  workers: 2,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run relay",
      url: "http://127.0.0.1:8787",
      reuseExistingServer: true,
    },
    {
      command: "npx vite preview --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
    },
  ],
});
