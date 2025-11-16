import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);

const token = process.env.SCREEPS_STATS_TOKEN || process.env.SCREEPS_TOKEN;
if (!token) {
  console.error("Missing SCREEPS_STATS_TOKEN or SCREEPS_TOKEN environment variable");
  process.exit(1);
}

const baseHost = process.env.SCREEPS_STATS_HOST || process.env.SCREEPS_HOST || "https://screeps.com";
const basePath = process.env.SCREEPS_STATS_API || `${baseHost.replace(/\/$/, "")}/api`;
const shard = process.env.SCREEPS_SHARD || "shard3";

// Use documented GET /api/user/memory endpoint to fetch Memory.stats
// This endpoint is officially documented in https://docs.screeps.com/auth-tokens.html
const endpoint = `${basePath.replace(/\/$/, "")}/user/memory?path=stats&shard=${shard}`;

const headers = {
  "X-Token": token,
  "Content-Type": "application/json",
  "User-Agent": "screeps-gpt-stats-monitor/1.0"
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} - The result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication errors (401, 403) or client errors (400, 422)
      if (
        error.status &&
        (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 422)
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`  ⚠ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function main() {
  const response = await retryWithBackoff(
    async () => {
      const res = await fetch(endpoint, { headers });

      if (!res.ok) {
        const text = await res.text();
        const error = new Error(`Failed to fetch Memory.stats (${res.status} ${res.statusText}): ${text}`);
        error.status = res.status;
        error.statusText = res.statusText;
        error.responseBody = text;
        throw error;
      }

      return res;
    },
    3,
    1000
  );

  const responseData = await response.json();
  
  // The Memory API returns data in gzipped format prefixed with "gz:"
  // We need to decompress it to get the actual stats
  let stats;
  if (responseData.data && typeof responseData.data === "string" && responseData.data.startsWith("gz:")) {
    const compressed = Buffer.from(responseData.data.slice(3), "base64");
    const decompressed = await gunzip(compressed);
    stats = JSON.parse(decompressed.toString());
  } else {
    // Fallback for non-gzipped response
    stats = responseData.data || responseData;
  }

  // Convert Memory.stats format to match the old /api/user/stats format
  // Memory.stats contains current tick data, we'll format it similarly
  const currentTick = Game?.time || Date.now();
  const payload = {
    ok: 1,
    stats: {
      [currentTick]: stats
    }
  };

  const fetchedAt = new Date().toISOString();
  const outputDir = resolve("reports", "screeps-stats");
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, "latest.json");
  const snapshot = {
    fetchedAt,
    endpoint,
    source: "memory",
    shard,
    payload
  };
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(filePath);
}

main().catch(error => {
  console.error("Unexpected error fetching Memory.stats");
  console.error(`Endpoint: ${endpoint}`);

  // Determine failure type for proper categorization
  let failureType = "unknown_error";
  let failureDetails = error.message || String(error);

  if (error.status) {
    failureType = `http_error_${error.status}`;
    console.error(`HTTP Status: ${error.status} ${error.statusText || ""}`);
    console.error(`Response: ${error.responseBody || error.message}`);

    // Provide helpful diagnostic information
    if (error.status === 401 || error.status === 403) {
      console.error("\n❌ Authentication failed. Please verify:");
      console.error("   - SCREEPS_TOKEN or SCREEPS_STATS_TOKEN is set correctly");
      console.error("   - The token has not expired");
      console.error("   - The token has proper permissions");
    } else if (error.status === 400 || error.status === 422) {
      console.error("\n❌ Invalid request parameters. Please verify:");
      console.error("   - Shard value is correct");
      console.error("   - Memory path 'stats' exists");
      console.error("   - API endpoint is correct");
    }
  } else {
    // Network errors don't have status codes
    failureType = "network_error";
    console.error("\n❌ Network error - API endpoint unreachable. Possible causes:");
    console.error("   - Screeps API infrastructure is down");
    console.error("   - Network connectivity issues");
    console.error("   - DNS resolution failure");
    console.error("   - Firewall or proxy blocking the connection");
    console.error(`\nError details: ${error.message || error}`);
  }

  // Create failure snapshot for monitoring system
  try {
    const outputDir = resolve("reports", "screeps-stats");
    mkdirSync(outputDir, { recursive: true });
    const filePath = resolve(outputDir, "latest.json");

    const failureSnapshot = {
      status: "memory_unavailable",
      failureType,
      timestamp: new Date().toISOString(),
      error: failureDetails,
      attempted_endpoint: endpoint,
      httpStatus: error.status || null,
      httpStatusText: error.statusText || null,
      source: "memory"
    };

    writeFileSync(filePath, JSON.stringify(failureSnapshot, null, 2));
    console.error(`\n⚠ Failure snapshot saved to: ${filePath}`);
    console.error("This snapshot will be used by the monitoring system to detect infrastructure failures.");
  } catch (snapshotError) {
    console.error("\n⚠ Failed to create failure snapshot:", snapshotError);
  }

  process.exit(1);
});
