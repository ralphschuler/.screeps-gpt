/**
 * Configuration and types for Screeps video rendering pipeline
 */

export interface VideoConfig {
  /** Target rooms to record and render */
  rooms: string[];
  /** Shard to record from */
  shard: string;
  /** Time window for replay capture */
  timeWindow: {
    /** Start tick (or relative like "24h", "7d") */
    start: string | number;
    /** End tick (or "now") */
    end: string | number;
  };
  /** Video rendering settings */
  rendering: {
    /** Output resolution width */
    width: number;
    /** Output resolution height */
    height: number;
    /** Frames per second */
    fps: number;
    /** Video codec */
    codec: "libx264" | "libx265";
    /** Ticks per frame (speed control) */
    ticksPerFrame: number;
  };
  /** Overlay settings */
  overlays: {
    /** Show timestamp */
    showTimestamp: boolean;
    /** Show tick counter */
    showTick: boolean;
    /** Show bot version */
    showVersion: boolean;
    /** Show room name */
    showRoomName: boolean;
  };
  /** Storage settings */
  storage: {
    /** Maximum replay data age in days */
    replayRetentionDays: number;
    /** Keep generated videos as artifacts */
    keepVideos: boolean;
  };
  /** YouTube upload settings */
  youtube?: {
    /** Upload enabled */
    enabled: boolean;
    /** Video title template */
    titleTemplate: string;
    /** Description template */
    descriptionTemplate: string;
    /** Video tags */
    tags: string[];
    /** Video visibility */
    visibility: "private" | "public" | "unlisted";
    /** Playlist to add video to */
    playlistId?: string;
  };
}

export interface RoomReplayData {
  /** Room name */
  room: string;
  /** Shard name */
  shard: string;
  /** Start tick */
  startTick: number;
  /** End tick */
  endTick: number;
  /** Timestamp of capture */
  capturedAt: string;
  /** Replay data from Screeps API */
  replayData: unknown;
}

export interface VideoMetadata {
  /** Room name */
  room: string;
  /** Shard name */
  shard: string;
  /** Start tick */
  startTick: number;
  /** End tick */
  endTick: number;
  /** Duration in seconds */
  duration: number;
  /** Total frames */
  totalFrames: number;
  /** Video file path */
  videoPath: string;
  /** Generated at timestamp */
  generatedAt: string;
  /** Bot version */
  botVersion: string;
}

export interface YouTubeUploadResult {
  /** Video ID on YouTube */
  videoId: string;
  /** Video URL */
  videoUrl: string;
  /** Upload timestamp */
  uploadedAt: string;
  /** Video title */
  title: string;
}

/**
 * Default configuration for video pipeline
 */
export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  rooms: [],
  shard: "shard3",
  timeWindow: {
    start: "24h",
    end: "now"
  },
  rendering: {
    width: 1920,
    height: 1080,
    fps: 30,
    codec: "libx264",
    ticksPerFrame: 10 // 10 ticks per frame = fast time-lapse
  },
  overlays: {
    showTimestamp: true,
    showTick: true,
    showVersion: true,
    showRoomName: true
  },
  storage: {
    replayRetentionDays: 30,
    keepVideos: true
  },
  youtube: {
    enabled: false,
    titleTemplate: "Screeps Bot - {room} - {startTick} to {endTick}",
    descriptionTemplate:
      "Autonomous Screeps AI gameplay recording\\n\\nRoom: {room}\\nShard: {shard}\\nTicks: {startTick} to {endTick}\\nBot Version: {version}\\n\\nGenerated automatically by screeps-gpt",
    tags: ["screeps", "ai", "automation", "gameplay", "screeps-bot"],
    visibility: "unlisted"
  }
};
