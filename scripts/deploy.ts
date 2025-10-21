import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScreepsAPI } from "screeps-api";
import { buildProject } from "./buildProject";

async function deploy(): Promise<void> {
  await buildProject(false);

  const dryRunFlag = process.env.SCREEPS_DEPLOY_DRY_RUN ?? "";
  const dryRun = ["1", "true", "yes"].includes(dryRunFlag.toLowerCase());

  const token = process.env.SCREEPS_TOKEN;
  if (!token && !dryRun) {
    throw new Error("SCREEPS_TOKEN secret is required for deployment");
  }

  const branch = process.env.SCREEPS_BRANCH ?? "main";
  const hostname = process.env.SCREEPS_HOST ?? "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL ?? "https";
  const port = Number(process.env.SCREEPS_PORT ?? 443);
  const path = process.env.SCREEPS_PATH ?? "/";

  const bundlePath = resolve("dist/main.js");
  const source = await readFile(bundlePath, "utf8");

  if (dryRun) {
    console.log(
      `[dry-run] Skipping Screeps API upload. Would deploy ${bundlePath} to ${hostname}:${port}${path} (branch ${branch}).`
    );
    return;
  }

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });
  await api.code.set(branch, [{ name: "main", body: source }]);
  console.log(`Deployed ${bundlePath} to branch ${branch}`);
}

deploy().catch(error => {
  console.error("Deployment failed", error);
  process.exitCode = 1;
});
