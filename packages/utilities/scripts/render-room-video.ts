/**
 * Render video from captured room history
 *
 * This script takes captured room replay data and generates a time-lapse
 * video with overlays showing tick counter, timestamp, and other metadata.
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Frame extraction from replay data (using screeps-world-printer or similar)
 * - ffmpeg integration for video encoding
 * - Overlay rendering for tick counter, timestamps, etc.
 */

import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { loadVideoConfig } from "./lib/video-config";
import { RoomReplayData, VideoMetadata } from "./types/video-pipeline";

/**
 * Load replay data from file
 */
async function loadReplayData(filepath: string): Promise<RoomReplayData> {
  const data = await readFile(filepath, "utf8");
  return JSON.parse(data) as RoomReplayData;
}

/**
 * Extract frames from replay data
 * TODO: Implement actual frame extraction using screeps-world-printer or SVG rendering
 */
async function extractFrames(
  replayData: RoomReplayData,
  outputDir: string,
  config: { rendering: { ticksPerFrame: number } }
): Promise<number> {
  console.log(`  Extracting frames from replay data...`);

  await mkdir(outputDir, { recursive: true });

  // Calculate number of frames based on tick range and ticksPerFrame setting
  const totalTicks = replayData.endTick - replayData.startTick;
  const frameCount = Math.ceil(totalTicks / config.rendering.ticksPerFrame);

  console.log(`    Total ticks: ${totalTicks}`);
  console.log(`    Ticks per frame: ${config.rendering.ticksPerFrame}`);
  console.log(`    Expected frames: ${frameCount}`);

  // TODO: Implement frame extraction
  // This would involve:
  // 1. Iterating through replay data at ticksPerFrame intervals
  // 2. Rendering each game state as an image (PNG/JPEG)
  // 3. Adding overlays (tick counter, timestamp, version)
  // 4. Saving frames as numbered files (frame_00001.png, etc.)

  console.warn(`    ⚠ Frame extraction not yet implemented`);
  console.warn(`    This requires integration with screeps-world-printer or custom renderer`);

  return frameCount;
}

/**
 * Render video from frames using ffmpeg
 * TODO: Implement ffmpeg integration
 */
async function renderVideo(
  _framesDir: string,
  outputPath: string,
  _config: { rendering: { fps: number } }
): Promise<void> {
  console.log(`  Rendering video with ffmpeg...`);

  // TODO: Implement ffmpeg video encoding
  // This would involve:
  // 1. Building ffmpeg command with proper parameters
  // 2. Input: frame sequence (frame_%05d.png)
  // 3. Output: MP4/WebM with specified codec and settings
  // 4. Bitrate, resolution, FPS configuration
  //
  // Example command:
  // ffmpeg -framerate 30 -i frames/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 23 output.mp4

  console.warn(`    ⚠ Video rendering not yet implemented`);
  console.warn(`    This requires ffmpeg installation and node integration (fluent-ffmpeg)`);

  // Create placeholder output file
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, "Placeholder video file", "utf8");
}

/**
 * Generate video metadata
 */
async function generateMetadata(
  replayData: RoomReplayData,
  videoPath: string,
  frameCount: number,
  config: { rendering: { fps: number } }
): Promise<VideoMetadata> {
  const duration = frameCount / config.rendering.fps;

  // Get bot version from package.json
  const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  const botVersion = packageJson.version || "unknown";

  return {
    room: replayData.room,
    shard: replayData.shard,
    startTick: replayData.startTick,
    endTick: replayData.endTick,
    duration,
    totalFrames: frameCount,
    videoPath,
    generatedAt: new Date().toISOString(),
    botVersion
  };
}

/**
 * Render video from replay data file
 */
async function renderFromReplay(replayFilepath: string): Promise<VideoMetadata> {
  console.log(`\nProcessing replay: ${basename(replayFilepath)}`);

  // Load configuration and replay data
  const config = await loadVideoConfig();
  const replayData = await loadReplayData(replayFilepath);

  console.log(`  Room: ${replayData.room}`);
  console.log(`  Shard: ${replayData.shard}`);
  console.log(`  Ticks: ${replayData.startTick} to ${replayData.endTick}`);

  // Set up directories
  const framesDir = resolve("reports", "video-frames", `${replayData.room}_${Date.now()}`);
  const outputDir = resolve("reports", "videos");
  await mkdir(outputDir, { recursive: true });

  const videoFilename = `${replayData.room}_${replayData.shard}_${replayData.startTick}-${replayData.endTick}.mp4`;
  const videoPath = resolve(outputDir, videoFilename);

  // Extract frames from replay
  const frameCount = await extractFrames(replayData, framesDir, config);

  // Render video from frames
  await renderVideo(framesDir, videoPath, config);

  // Generate metadata
  const metadata = await generateMetadata(replayData, videoPath, frameCount, config);

  // Save metadata
  const metadataPath = videoPath.replace(".mp4", ".json");
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  console.log(`  ✓ Video rendered: ${videoPath}`);
  console.log(`  ✓ Metadata saved: ${metadataPath}`);

  return metadata;
}

/**
 * Main render function - process all replay files
 */
async function renderRoomVideos(): Promise<void> {
  console.log("Starting video rendering...");

  // Find all replay files
  const replayDir = resolve("reports", "replay-data");
  let replayFiles: string[] = [];

  try {
    const files = await readdir(replayDir);
    replayFiles = files.filter(f => f.endsWith(".json")).map(f => resolve(replayDir, f));
  } catch (error) {
    console.error("Failed to read replay directory:", error);
    throw new Error("No replay data found. Run capture-room-history.ts first.");
  }

  if (replayFiles.length === 0) {
    console.warn("No replay files found in reports/replay-data/");
    console.warn("Run capture-room-history.ts first to capture room data");
    return;
  }

  console.log(`Found ${replayFiles.length} replay file(s)`);

  // Render each replay
  const results: VideoMetadata[] = [];
  for (const replayFile of replayFiles) {
    try {
      const metadata = await renderFromReplay(replayFile);
      results.push(metadata);
    } catch (error) {
      console.error(`Failed to render ${basename(replayFile)}:`, error);
      // Continue with other files
    }
  }

  console.log(`\n✓ Rendering complete!`);
  console.log(`  Rendered ${results.length} of ${replayFiles.length} videos`);
  console.log(`  Videos saved to: reports/videos/`);

  console.warn(`\n⚠ Note: This is a stub implementation`);
  console.warn(`  Full video rendering requires additional dependencies:`);
  console.warn(`  - ffmpeg (system package)`);
  console.warn(`  - fluent-ffmpeg (npm package)`);
  console.warn(`  - screeps-world-printer or similar for frame rendering`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  renderRoomVideos().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { renderRoomVideos, renderFromReplay };
