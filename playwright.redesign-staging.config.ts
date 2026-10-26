import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const staging = process.env.TELEO_STAGING_URL;
if (!staging)
  throw new Error("Set TELEO_STAGING_URL to the authorized staging origin.");
export default defineConfig({
  ...base,
  testMatch: "redesign.spec.ts",
  use: { ...base.use, baseURL: staging },
  webServer: undefined,
});
