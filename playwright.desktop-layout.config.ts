import { defineConfig } from "@playwright/test";
import base from "./playwright.library.config";
export default defineConfig({
  ...base,
  testMatch: "desktop-layout.spec.ts",
  outputDir: "test-results/desktop-layout",
});
