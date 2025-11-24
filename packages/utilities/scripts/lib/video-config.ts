/**
 * Video pipeline configuration loader
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_VIDEO_CONFIG, VideoConfig } from "../types/video-pipeline";

/**
 * Load video configuration from file or environment
 */
export async function loadVideoConfig(): Promise<VideoConfig> {
  const configPath = process.env.VIDEO_CONFIG_PATH || resolve("config", "video-pipeline.json");

  try {
    const configData = await readFile(configPath, "utf8");
    const userConfig = JSON.parse(configData) as Partial<VideoConfig>;

    // Merge with defaults
    return {
      ...DEFAULT_VIDEO_CONFIG,
      ...userConfig,
      rendering: {
        ...DEFAULT_VIDEO_CONFIG.rendering,
        ...userConfig.rendering
      },
      overlays: {
        ...DEFAULT_VIDEO_CONFIG.overlays,
        ...userConfig.overlays
      },
      storage: {
        ...DEFAULT_VIDEO_CONFIG.storage,
        ...userConfig.storage
      },
      youtube: userConfig.youtube
        ? {
            ...DEFAULT_VIDEO_CONFIG.youtube!,
            ...userConfig.youtube
          }
        : DEFAULT_VIDEO_CONFIG.youtube
    };
  } catch (_error) {
    // If no config file, use defaults with environment overrides
    console.warn(`No video config found at ${configPath}, using defaults`);
    return applyEnvironmentOverrides(DEFAULT_VIDEO_CONFIG);
  }
}

/**
 * Apply environment variable overrides to config
 */
function applyEnvironmentOverrides(config: VideoConfig): VideoConfig {
  return {
    ...config,
    rooms: process.env.VIDEO_ROOMS ? process.env.VIDEO_ROOMS.split(",") : config.rooms,
    shard: process.env.VIDEO_SHARD || config.shard,
    rendering: {
      ...config.rendering,
      width: process.env.VIDEO_WIDTH ? parseInt(process.env.VIDEO_WIDTH, 10) : config.rendering.width,
      height: process.env.VIDEO_HEIGHT ? parseInt(process.env.VIDEO_HEIGHT, 10) : config.rendering.height,
      fps: process.env.VIDEO_FPS ? parseInt(process.env.VIDEO_FPS, 10) : config.rendering.fps
    },
    youtube: config.youtube
      ? {
          ...config.youtube,
          enabled: process.env.YOUTUBE_ENABLED === "true" || config.youtube.enabled
        }
      : undefined
  };
}

/**
 * Parse time window string (e.g., "24h", "7d") to tick offset
 */
export function parseTimeWindow(timeStr: string | number): number {
  if (typeof timeStr === "number") {
    return timeStr;
  }

  if (timeStr === "now") {
    return Date.now();
  }

  const match = timeStr.match(/^(\d+)(h|d|w)$/);
  if (!match) {
    throw new Error(`Invalid time window format: ${timeStr}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const msPerTick = 3000; // Screeps ticks are ~3 seconds
  const ticksPerHour = (60 * 60 * 1000) / msPerTick;
  const ticksPerDay = ticksPerHour * 24;
  const ticksPerWeek = ticksPerDay * 7;

  switch (unit) {
    case "h":
      return Math.floor(ticksPerHour * value);
    case "d":
      return Math.floor(ticksPerDay * value);
    case "w":
      return Math.floor(ticksPerWeek * value);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}
