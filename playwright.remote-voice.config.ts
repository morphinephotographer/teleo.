import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: [
    "remote-voice.spec.ts",
    "voice-follow.spec.ts",
    "voice-ipad.spec.ts",
  ],
  outputDir: "test-results/remote-voice",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.TELEO_VOICE_URL || "http://127.0.0.1:8797",
    trace: "retain-on-failure",
  },
  webServer: process.env.TELEO_VOICE_URL
    ? undefined
    : {
        command:
          "npx wrangler dev --config services/production/wrangler.local.jsonc --port 8797 --inspector-port 9247 --var APP_ORIGIN:http://127.0.0.1:8797 --persist-to .wrangler/remote-voice",
        url: "http://127.0.0.1:8797",
        reuseExistingServer: false,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
  ],
});
