import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScreepsAPI } from "screeps-api";
import { buildProject } from "./buildProject";

interface ApiError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 1000): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = isApiError(error) ? error : new Error(String(error));

      // Don't retry on authentication or configuration errors
      if (isApiError(error)) {
        if (
          error.message?.includes("SCREEPS_TOKEN") ||
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`  ⚠ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Operation failed after all retries");
}

async function deploy(): Promise<void> {
  // Preserve MODULAR_BUILD setting during deployment
  await buildProject(false);

  const dryRunFlag = process.env.SCREEPS_DEPLOY_DRY_RUN ?? "";
  const dryRun = ["1", "true", "yes"].includes(dryRunFlag.toLowerCase());

  const token = process.env.SCREEPS_TOKEN;
  if (!token && !dryRun) {
    throw new Error("SCREEPS_TOKEN secret is required for deployment");
  }

  const branch = process.env.SCREEPS_BRANCH || "main";
  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = Number(process.env.SCREEPS_PORT || 443);
  const path = process.env.SCREEPS_PATH || "/";

  const distDir = resolve("dist");

  console.log(`Reading compiled bot code from ${distDir}...`);

  // Read all .js files from dist directory
  const modules: Record<string, string> = {};

  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(distDir);

    for (const file of files) {
      if (file.endsWith(".js")) {
        const moduleName = file.replace(".js", "");
        const filePath = resolve(distDir, file);
        const source = await readFile(filePath, "utf8");

        if (!source || source.trim().length === 0) {
          throw new Error(`Build output at ${filePath} is empty. Please run: npm run build`);
        }

        modules[moduleName] = source;
        console.log(`  ✓ Loaded ${moduleName} (${source.length} bytes)`);
      }
    }
  } catch (error: unknown) {
    const errorMessage = isApiError(error) ? error.message : String(error);
    console.error(`✗ Failed to read build output from ${distDir}`);
    console.error(`  Error: ${errorMessage}`);
    console.error(`\nPlease ensure the project is built before deploying:`);
    console.error(`  npm run build`);
    throw error;
  }

  if (Object.keys(modules).length === 0) {
    throw new Error(`No build output found in ${distDir}. Please run: npm run build`);
  }

  if (!modules.main) {
    throw new Error(`Missing main module in ${distDir}. Please run: npm run build`);
  }

  const totalSize = Object.values(modules).reduce((sum, code) => sum + code.length, 0);
  console.log(`✓ Build output loaded: ${Object.keys(modules).length} module(s), ${totalSize} bytes total`);

  if (dryRun) {
    console.log(
      `[dry-run] Skipping Screeps API upload. Would deploy ${Object.keys(modules).length} module(s) to ${hostname}:${port}${path} (branch ${branch}).`
    );
    console.log(`  Modules: ${Object.keys(modules).join(", ")}`);
    return;
  }

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  console.log(`Uploading code to ${hostname}:${port}${path} on branch "${branch}"...`);

  try {
    const result = await retryWithBackoff<{ ok?: number }>(
      async () => api.code.set(branch, modules) as Promise<{ ok?: number }>,
      3,
      1000
    );

    if (result && result.ok) {
      console.log(`✓ Successfully deployed to branch ${branch}`);
      for (const [moduleName, code] of Object.entries(modules)) {
        console.log(`  • ${moduleName}: ${code.length} bytes`);
      }
    } else {
      console.error(`✗ Deployment completed but received unexpected response:`, result);
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    if (isApiError(error)) {
      console.error(`✗ Failed to upload code to Screeps API:`);
      console.error(`  Error: ${error.message}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data:`, error.response.data);
      }
    } else {
      console.error(`✗ Failed to upload code to Screeps API:`, error);
    }
    throw error;
  }
}

deploy().catch(error => {
  console.error("Deployment failed", error);
  process.exitCode = 1;
});
