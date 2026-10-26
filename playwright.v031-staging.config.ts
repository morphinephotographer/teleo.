import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const origin = process.env.TELEO_V031_URL;
if (!origin)
  throw Error("Set TELEO_V031_URL to the authorized staging origin.");
export default defineConfig({
  ...base,
  testMatch: ["v031.spec.ts", "redesign.spec.ts"],
  outputDir: "test-results/v031-staging",
  use: { ...base.use, baseURL: origin },
  webServer: undefined,
});
