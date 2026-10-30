import { defineConfig } from "@playwright/test";
import base from "./playwright.quick-send.config";
export default defineConfig({
  ...base,
  outputDir: "test-results/mobile-layout-run",
  testMatch: "mobile-layout.spec.ts",
});
