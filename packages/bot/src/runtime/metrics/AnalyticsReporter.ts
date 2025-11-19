import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Analytics reporter for sending Screeps statistics to external monitoring systems.
 * Supports HTTP POST integration for real-time telemetry and observability.
 *
 * @example
 * ```ts
 * const reporter = new AnalyticsReporter({
 *   endpoint: "https://monitoring.example.com/api/stats",
 *   apiKey: process.env.ANALYTICS_API_KEY
 * });
 * reporter.queueReport(Memory.stats);
 * ```
 */
export interface AnalyticsConfig {
  /** HTTP endpoint for stats reporting */
  endpoint?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Batch size for stats aggregation */
  batchSize?: number;
  /** Enable compression for large payloads */
  enableCompression?: boolean;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn" | "error">;
}

export interface StatsReport {
  timestamp: number;
  stats: unknown;
  metadata?: {
    shard?: string;
    user?: string;
    version?: string;
  };
}

@profile
export class AnalyticsReporter {
  private static readonly MAX_RETRY_QUEUE_MULTIPLIER = 2;

  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly batchSize: number;
  private readonly enableCompression: boolean;
  private readonly logger: Pick<Console, "log" | "warn" | "error">;
  private readonly reportQueue: StatsReport[] = [];
  private isFlushing = false;

  public constructor(config: AnalyticsConfig = {}) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.batchSize = config.batchSize ?? 10;
    this.enableCompression = config.enableCompression ?? false;
    this.logger = config.logger ?? console;
  }

  /**
   * Queue a stats report for batch processing
   */
  public queueReport(stats: unknown, metadata?: StatsReport["metadata"]): void {
    const report: StatsReport = {
      timestamp: Game.time,
      stats,
      metadata
    };

    this.reportQueue.push(report);

    if (this.reportQueue.length >= this.batchSize && !this.isFlushing) {
      void this.flush();
    }
  }

  /**
   * Send queued reports immediately
   */
  public async flush(): Promise<void> {
    if (this.reportQueue.length === 0) {
      return;
    }

    if (this.isFlushing) {
      return; // Prevent concurrent flushes
    }

    if (!this.endpoint) {
      this.logger.warn("[AnalyticsReporter] No endpoint configured, skipping flush");
      this.reportQueue.length = 0;
      return;
    }

    this.isFlushing = true;
    const reports = [...this.reportQueue];
    this.reportQueue.length = 0;

    try {
      await this.sendReports(reports);
      this.logger.log(`[AnalyticsReporter] Successfully sent ${reports.length} reports`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AnalyticsReporter] Failed to send reports: ${errorMsg}`);
      // Re-queue failed reports (with limit to prevent unbounded growth)
      if (this.reportQueue.length < this.batchSize * AnalyticsReporter.MAX_RETRY_QUEUE_MULTIPLIER) {
        this.reportQueue.push(...reports);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Send reports to the analytics endpoint via HTTP POST
   */
  private async sendReports(reports: StatsReport[]): Promise<void> {
    if (!this.endpoint) {
      throw new Error("Analytics endpoint not configured");
    }

    const payload = this.enableCompression ? this.compressPayload(reports) : reports;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Note: In actual Screeps environment, HTTP requests would need to use
    // the InterShardMemory or external worker processes since Screeps doesn't
    // support direct HTTP requests from the game code
    if (typeof fetch !== "undefined") {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } else {
      this.logger.warn("[AnalyticsReporter] fetch not available in this environment");
    }
  }

  /**
   * Compress payload for efficient transmission
   */
  private compressPayload(reports: StatsReport[]): { compressed: boolean; data: string } {
    // Simple compression: remove duplicated fields and use shorter keys
    const compressed = {
      ts: Game.time,
      r: reports.map(r => ({
        t: r.timestamp,
        s: r.stats,
        m: r.metadata
      }))
    };

    return {
      compressed: true,
      data: JSON.stringify(compressed)
    };
  }

  /**
   * Generate summary statistics from queued reports
   */
  public getSummary(): {
    queuedReports: number;
    oldestReport: number | null;
    compressionEnabled: boolean;
  } {
    return {
      queuedReports: this.reportQueue.length,
      oldestReport: this.reportQueue.length > 0 ? this.reportQueue[0].timestamp : null,
      compressionEnabled: this.enableCompression
    };
  }

  /**
   * Clear all queued reports
   */
  public clear(): void {
    this.reportQueue.length = 0;
  }
}
