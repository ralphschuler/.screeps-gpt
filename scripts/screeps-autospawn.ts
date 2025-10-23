import process from "node:process";
import { writeFile } from "node:fs/promises";
import { ScreepsAPI } from "screeps-api";

interface WorldStatusResponse {
  ok: number;
  status: "normal" | "lost" | "empty";
}

interface ApiError extends Error {
  response?: {
    status?: number;
    data?: unknown;
  };
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error;
}

/**
 * Set GitHub Actions output
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    writeFile(outputFile, `${name}=${value}\n`, { flag: "a" }).catch(err => {
      console.error(`Failed to write output ${name}:`, err);
    });
  }
}

/**
 * Check spawn status and perform auto-respawn if needed
 */
async function checkAndRespawn(): Promise<void> {
  const token = process.env.SCREEPS_TOKEN;
  if (!token) {
    throw new Error("SCREEPS_TOKEN is required for autospawner");
  }

  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = Number(process.env.SCREEPS_PORT || 443);
  const path = process.env.SCREEPS_PATH || "/";

  console.log(`🔍 Checking spawn status on ${hostname}:${port}${path}...`);

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  try {
    // Check current world status using the API's raw.user.worldStatus() method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const statusResult = (await (api as any).raw.user.worldStatus()) as WorldStatusResponse;

    if (!statusResult.ok) {
      throw new Error("Failed to retrieve world status from Screeps API");
    }

    const { status } = statusResult;
    console.log(`📊 Current spawn status: ${status}`);

    // Early exit if bot is already spawned
    if (status === "normal") {
      console.log("✅ Bot is already spawned and active. No action needed.");
      setOutput("status", status);
      setOutput("action", "none");
      return;
    }

    // Handle lost or empty status
    if (status === "lost" || status === "empty") {
      console.log(`⚠️ Bot needs respawning (status: ${status})`);
      console.log("🚀 Triggering automatic respawn...");

      // Note: The actual respawn logic would go here
      // For now, we're implementing the status check and early exit logic
      // The full respawn implementation would require additional API calls
      // to select a suitable room and place the spawn

      console.log("⚠️ Respawn logic not yet implemented.");
      console.log("   Manual respawn required through Screeps web interface.");

      setOutput("status", status);
      setOutput("action", "none");

      // Exit with error to signal that manual intervention is needed
      process.exitCode = 1;
      return;
    }

    // Unknown status
    console.warn(`⚠️ Unknown spawn status: ${String(status)}`);
    setOutput("status", String(status));
    setOutput("action", "none");
  } catch (error: unknown) {
    if (isApiError(error)) {
      console.error("❌ Failed to check spawn status:");
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
    } else {
      console.error("❌ Unexpected error checking spawn status:", error);
    }
    throw error;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await checkAndRespawn();
  } catch (error) {
    console.error("Autospawn check failed:", error);
    process.exitCode = 1;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { checkAndRespawn };
