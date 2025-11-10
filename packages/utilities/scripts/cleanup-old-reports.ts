import { applyRetentionPolicy, listReports } from "./lib/report-storage.js";

/**
 * Report types to clean up
 */
const REPORT_TYPES = ["ptr-stats", "evaluations", "profiler"];

/**
 * Default retention configuration
 */
const RETENTION_CONFIG = {
  maxAgeDays: 30,
  minReportsToKeep: 10
};

/**
 * Clean up old reports across all report types
 */
async function main(): Promise<void> {
  console.log("Starting report cleanup...");
  console.log(
    `Configuration: Keep minimum ${RETENTION_CONFIG.minReportsToKeep} reports, max age ${RETENTION_CONFIG.maxAgeDays} days\n`
  );

  let totalDeleted = 0;

  for (const reportType of REPORT_TYPES) {
    try {
      const reports = await listReports(reportType);
      const reportCount = reports.length;

      if (reportCount === 0) {
        console.log(`${reportType}: No reports found`);
        continue;
      }

      const deletedCount = await applyRetentionPolicy(reportType, RETENTION_CONFIG);

      if (deletedCount > 0) {
        console.log(
          `${reportType}: Cleaned up ${deletedCount} old report(s) (${reportCount - deletedCount} remaining)`
        );
        totalDeleted += deletedCount;
      } else {
        console.log(`${reportType}: No cleanup needed (${reportCount} reports within retention period)`);
      }
    } catch (error) {
      console.error(`${reportType}: Failed to apply retention policy -`, error);
    }
  }

  console.log(`\n✓ Cleanup complete: ${totalDeleted} report(s) deleted`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error during cleanup:", error);
    process.exit(1);
  });
}

export { main as cleanupOldReports };
