import { defineConfig } from "@playwright/test";
import base from "./playwright.approval.config";
export default defineConfig({
  ...base,
  testMatch: ["reading-polish.spec.ts", "approval-v3.spec.ts"],
  timeout: 60000,
  outputDir: "test-results/reading-polish",
});
