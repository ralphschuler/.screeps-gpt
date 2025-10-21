import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const token = process.env.SCREEPS_STATS_TOKEN || process.env.SCREEPS_TOKEN;
if (!token) {
  console.error("Missing SCREEPS_STATS_TOKEN or SCREEPS_TOKEN environment variable");
  process.exit(1);
}

const baseHost = process.env.SCREEPS_STATS_HOST || process.env.SCREEPS_HOST || "https://screeps.com";
const basePath = process.env.SCREEPS_STATS_API || `${baseHost.replace(/\/$/, "")}/api`;
const endpoint = `${basePath.replace(/\/$/, "")}/user/stats`;

const headers = {
  "X-Token": token,
  "Content-Type": "application/json",
  "User-Agent": "screeps-gpt-stats-monitor/1.0"
};

async function main() {
  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to fetch Screeps stats (${response.status} ${response.statusText}): ${text}`);
    process.exit(1);
  }

  const payload = await response.json();
  const fetchedAt = new Date().toISOString();
  const outputDir = resolve("reports", "screeps-stats");
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, "latest.json");
  const snapshot = {
    fetchedAt,
    endpoint,
    payload
  };
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(filePath);
}

main().catch(error => {
  console.error("Unexpected error fetching Screeps stats");
  console.error(error);
  process.exit(1);
});
