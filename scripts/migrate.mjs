import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db:push] DATABASE_URL is not set; skipping database migrations."
  );
  process.exit(0);
}

const result = spawnSync("drizzle-kit", ["migrate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
