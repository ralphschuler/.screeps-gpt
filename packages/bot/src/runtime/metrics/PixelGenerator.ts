import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Pixel generation configuration
 */
export interface PixelGeneratorOptions {
  /**
   * Minimum bucket level required to generate a pixel.
   * Default: 10000 (full bucket)
   */
  minBucketLevel?: number;
}

/**
 * Manages automatic pixel generation when CPU bucket is full.
 * Implements deterministic output for testability.
 */
@profile
export class PixelGenerator {
  private readonly options: Required<PixelGeneratorOptions>;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(options: PixelGeneratorOptions = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.options = {
      minBucketLevel: options.minBucketLevel ?? 10000
    };
    this.logger = logger;
  }

  /**
   * Attempts to generate a pixel if the CPU bucket is full.
   * Returns true if a pixel was generated, false otherwise.
   *
   * @param cpuBucket - Current CPU bucket level
   * @param generatePixelFn - Function to call to generate a pixel (injected for testability)
   * @returns true if pixel was generated, false otherwise
   */
  public tryGeneratePixel(
    cpuBucket: number,
    generatePixelFn: () => number = () => (typeof Game !== "undefined" && Game.cpu ? Game.cpu.generatePixel() : OK)
  ): boolean {
    if (cpuBucket >= this.options.minBucketLevel) {
      const result = generatePixelFn();
      if (result === OK) {
        this.logger.log(`Generated pixel (bucket: ${cpuBucket})`);
        return true;
      } else {
        this.logger.warn(`Failed to generate pixel: ${result}`);
        return false;
      }
    }
    return false;
  }
}
