import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: [
    "production.spec.ts",
    "library-panel.spec.ts",
    "mobile-layout.spec.ts",
    "desktop-layout.spec.ts",
    "reading-polish.spec.ts",
    "remote-permissions.spec.ts",
    "topbar.spec.ts",
    "editor-tools.spec.ts",
    "ui-alignment.spec.ts",
    "import-docx.spec.ts",
    "intro.spec.ts",
    "tour.spec.ts",
    "reader-keys.spec.ts",
    "font-size-release.spec.ts",
    "remote-voice.spec.ts",
    "voice-follow.spec.ts",
    "voice-ipad.spec.ts",
  ],
  // This scenario imports source modules and runs in playwright.dev-audit.config.ts.
  grepInvert: /phone seeks animate/,
  outputDir: "test-results/site-audit",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/site-audit/results.json" }],
  ],
  workers: 2,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:8795", trace: "retain-on-failure" },
  webServer: {
    command:
      "npx wrangler dev --config services/production/wrangler.local.jsonc --port 8795 --inspector-port 9245 --var APP_ORIGIN:http://127.0.0.1:8795 --persist-to .wrangler/site-audit",
    url: "http://127.0.0.1:8795",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
