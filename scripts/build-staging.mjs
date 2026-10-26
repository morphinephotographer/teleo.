import { spawnSync } from "node:child_process";
// A staging build MUST use its own origin. Do not bake a production relay URL into it.
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_RELAY_URL: "" },
  },
);
process.exit(result.status ?? 1);
