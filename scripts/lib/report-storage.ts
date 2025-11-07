import { existsSync } from "node:fs";
import { mkdir, writeFile, readdir, readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";

/**
 * Interface for timestamped report metadata
 */
export interface ReportMetadata {
  timestamp: string;
  filename: string;
  type: string;
  path: string;
}

/**
 * Configuration for report retention policy
 */
export interface RetentionConfig {
  maxAgeDays: number;
  minReportsToKeep: number;
}

/**
 * Default retention configuration
 */
const DEFAULT_RETENTION: RetentionConfig = {
  maxAgeDays: 30,
  minReportsToKeep: 10
};

/**
 * Generate timestamped filename for a report
 * @param type Report type (e.g., 'ptr-stats', 'evaluation')
 * @param extension File extension (default: 'json')
 * @returns Timestamped filename
 */
export function generateTimestampedFilename(type: string, extension: string = "json"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${type}-${timestamp}.${extension}`;
}

/**
 * Save a report with timestamp to the reports directory
 * @param type Report type (subdirectory name)
 * @param data Report data to save
 * @param filename Optional filename override (defaults to timestamped)
 * @returns Path to saved file
 */
export async function saveReport(type: string, data: unknown, filename?: string): Promise<string> {
  const reportDir = resolve("reports", type);
  await mkdir(reportDir, { recursive: true });

  const reportFilename = filename || generateTimestampedFilename(type);
  const filePath = join(reportDir, reportFilename);

  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");

  return filePath;
}

/**
 * List all reports of a specific type, sorted by timestamp (newest first)
 * @param type Report type (subdirectory name)
 * @returns Array of report metadata sorted by timestamp descending
 */
export async function listReports(type: string): Promise<ReportMetadata[]> {
  const reportDir = resolve("reports", type);

  if (!existsSync(reportDir)) {
    return [];
  }

  const files = await readdir(reportDir);
  const reports: ReportMetadata[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const filePath = join(reportDir, file);

    // Extract timestamp from filename (format: type-YYYY-MM-DDTHH-MM-SS-SSSZ.json)
    const match = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    if (match) {
      // Convert from YYYY-MM-DDTHH-MM-SS-SSSZ to YYYY-MM-DDTHH:MM:SS.SSSZ
      const timestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z");
      reports.push({
        timestamp,
        filename: file,
        type,
        path: filePath
      });
    }
  }

  // Sort by timestamp descending (newest first)
  return reports.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Load the most recent report of a specific type
 * @param type Report type (subdirectory name)
 * @returns Report data or null if no reports exist
 */
export async function loadLatestReport<T = unknown>(type: string): Promise<T | null> {
  const reports = await listReports(type);

  if (reports.length === 0) {
    return null;
  }

  const latestReport = reports[0];
  const content = await readFile(latestReport.path, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Load a specific report by filename
 * @param type Report type (subdirectory name)
 * @param filename Report filename
 * @returns Report data or null if not found
 */
export async function loadReport<T = unknown>(type: string, filename: string): Promise<T | null> {
  const filePath = resolve("reports", type, filename);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Apply retention policy to remove old reports
 * @param type Report type (subdirectory name)
 * @param config Retention configuration
 * @returns Number of reports deleted
 */
export async function applyRetentionPolicy(type: string, config: RetentionConfig = DEFAULT_RETENTION): Promise<number> {
  const reports = await listReports(type);

  if (reports.length <= config.minReportsToKeep) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.maxAgeDays);

  let deletedCount = 0;

  // Keep at least minReportsToKeep reports regardless of age
  const reportsToConsider = reports.slice(config.minReportsToKeep);

  for (const report of reportsToConsider) {
    const reportDate = new Date(report.timestamp);
    if (reportDate < cutoffDate) {
      await unlink(report.path);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Get reports within a date range
 * @param type Report type (subdirectory name)
 * @param startDate Start date (inclusive)
 * @param endDate End date (inclusive)
 * @returns Array of report metadata within the date range
 */
export async function getReportsInRange(type: string, startDate: Date, endDate: Date): Promise<ReportMetadata[]> {
  const allReports = await listReports(type);

  return allReports.filter(report => {
    const reportDate = new Date(report.timestamp);
    return reportDate >= startDate && reportDate <= endDate;
  });
}
