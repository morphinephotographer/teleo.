import { defineConfig } from "@playwright/test";
import library from "./playwright.library.config";

export default defineConfig({
  ...library,
  testMatch: "mac-install.spec.ts",
  outputDir: "test-results/mac-install",
});
