import { execFileSync, spawnSync } from "node:child_process";
if (!process.stdout.isTTY)
  throw Error(
    "Use an interactive terminal so Wrangler cannot silently overwrite conflicting DNS records",
  );
const status = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
if (status) throw Error("Commit verified work before deploying production");
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const result = spawnSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "deploy",
    "--config",
    "wrangler.jsonc",
    "--var",
    `RELEASE_COMMIT:${commit}`,
  ],
  { stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
);
process.exit(result.status ?? 1);
