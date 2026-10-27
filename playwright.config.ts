import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "production.spec.ts",
  outputDir: "test-results/local",
  timeout: 30000,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npm run staging:local",
      url: "http://127.0.0.1:8788",
      reuseExistingServer: true,
    },
    {
      command: "npx vite preview --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
    },
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
  ],
});
