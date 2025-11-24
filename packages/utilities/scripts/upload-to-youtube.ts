/**
 * Upload rendered videos to YouTube
 *
 * This script handles YouTube API authentication and video upload with metadata.
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - googleapis npm package
 * - YouTube Data API v3 credentials
 * - OAuth 2.0 authentication flow
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadVideoConfig } from "./lib/video-config";
import { VideoMetadata, YouTubeUploadResult } from "./types/video-pipeline";

/**
 * Initialize YouTube API client
 * TODO: Implement actual YouTube API client initialization
 */
function initYouTubeClient(): null {
  // Check for required credentials
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YouTube credentials not configured. Required environment variables: " +
        "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN"
    );
  }

  console.warn("⚠ YouTube API client initialization not yet implemented");
  console.warn("  This requires googleapis npm package");

  // TODO: Implement OAuth2 client initialization
  // const { google } = require('googleapis');
  // const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  // oauth2Client.setCredentials({ refresh_token: refreshToken });
  // return google.youtube({ version: 'v3', auth: oauth2Client });

  return null;
}

/**
 * Generate video title from template
 */
function generateTitle(template: string, metadata: VideoMetadata): string {
  return template
    .replace("{room}", metadata.room)
    .replace("{shard}", metadata.shard)
    .replace("{startTick}", metadata.startTick.toString())
    .replace("{endTick}", metadata.endTick.toString())
    .replace("{version}", metadata.botVersion);
}

/**
 * Generate video description from template
 */
function generateDescription(template: string, metadata: VideoMetadata): string {
  return template
    .replace("{room}", metadata.room)
    .replace("{shard}", metadata.shard)
    .replace("{startTick}", metadata.startTick.toString())
    .replace("{endTick}", metadata.endTick.toString())
    .replace("{version}", metadata.botVersion)
    .replace("\\n", "\n");
}

/**
 * Upload video to YouTube
 * TODO: Implement actual YouTube upload
 */
async function uploadVideo(
  _youtube: null,
  videoPath: string,
  metadata: VideoMetadata,
  config: { youtube?: { enabled: boolean; titleTemplate: string; descriptionTemplate: string; tags: string[]; visibility: string } }
): Promise<YouTubeUploadResult> {
  if (!config.youtube?.enabled) {
    throw new Error("YouTube upload is not enabled in configuration");
  }

  console.log(`  Uploading video to YouTube...`);
  console.log(`    File: ${videoPath}`);

  const title = generateTitle(config.youtube.titleTemplate, metadata);
  const description = generateDescription(config.youtube.descriptionTemplate, metadata);

  console.log(`    Title: ${title}`);
  console.log(`    Description: ${description.substring(0, 100)}...`);
  console.log(`    Tags: ${config.youtube.tags.join(", ")}`);
  console.log(`    Visibility: ${config.youtube.visibility}`);

  // TODO: Implement actual upload
  // const response = await youtube.videos.insert({
  //   part: 'snippet,status',
  //   requestBody: {
  //     snippet: {
  //       title,
  //       description,
  //       tags: config.youtube.tags,
  //       categoryId: '20', // Gaming category
  //     },
  //     status: {
  //       privacyStatus: config.youtube.visibility,
  //     },
  //   },
  //   media: {
  //     body: fs.createReadStream(videoPath),
  //   },
  // });

  console.warn(`    ⚠ YouTube upload not yet implemented`);
  console.warn(`    This requires googleapis npm package and valid credentials`);

  // Return mock result
  const result: YouTubeUploadResult = {
    videoId: "MOCK_VIDEO_ID",
    videoUrl: "https://youtube.com/watch?v=MOCK_VIDEO_ID",
    uploadedAt: new Date().toISOString(),
    title
  };

  console.log(`    ✓ Mock upload complete (videoId: ${result.videoId})`);

  return result;
}

/**
 * Add video to playlist
 * TODO: Implement playlist management
 */
async function addToPlaylist(_youtube: null, videoId: string, playlistId: string): Promise<void> {
  console.log(`  Adding video to playlist ${playlistId}...`);

  // TODO: Implement playlist addition
  // await youtube.playlistItems.insert({
  //   part: 'snippet',
  //   requestBody: {
  //     snippet: {
  //       playlistId,
  //       resourceId: {
  //         kind: 'youtube#video',
  //         videoId,
  //       },
  //     },
  //   },
  // });

  console.warn(`    ⚠ Playlist management not yet implemented`);
}

/**
 * Upload video with metadata
 */
async function uploadVideoWithMetadata(videoPath: string, metadataPath: string): Promise<YouTubeUploadResult> {
  console.log(`\nUploading video: ${videoPath}`);

  // Load configuration and metadata
  const config = await loadVideoConfig();
  const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as VideoMetadata;

  if (!config.youtube?.enabled) {
    console.warn("YouTube upload disabled in configuration");
    console.warn("Set youtube.enabled=true in config or YOUTUBE_ENABLED=true in environment");
    throw new Error("YouTube upload disabled");
  }

  // Initialize YouTube client
  const youtube = initYouTubeClient();

  // Upload video
  const result = await uploadVideo(youtube, videoPath, metadata, config);

  // Add to playlist if configured
  if (config.youtube.playlistId && youtube) {
    await addToPlaylist(youtube, result.videoId, config.youtube.playlistId);
  }

  console.log(`  ✓ Upload complete!`);
  console.log(`    Video URL: ${result.videoUrl}`);

  return result;
}

/**
 * Main upload function - upload all rendered videos
 */
async function uploadToYouTube(): Promise<void> {
  console.log("Starting YouTube upload...");

  // Load configuration
  const config = await loadVideoConfig();

  if (!config.youtube?.enabled) {
    console.warn("YouTube upload disabled in configuration");
    console.warn("Enable it by setting youtube.enabled=true in config file");
    return;
  }

  // Find all videos to upload
  const { readdir } = await import("node:fs/promises");
  const videosDir = resolve("reports", "videos");
  let videoFiles: string[] = [];

  try {
    const files = await readdir(videosDir);
    videoFiles = files.filter(f => f.endsWith(".mp4"));
  } catch (error) {
    console.error("Failed to read videos directory:", error);
    throw new Error("No videos found. Run render-room-video.ts first.");
  }

  if (videoFiles.length === 0) {
    console.warn("No video files found in reports/videos/");
    console.warn("Run render-room-video.ts first to generate videos");
    return;
  }

  console.log(`Found ${videoFiles.length} video(s) to upload`);

  // Upload each video
  const results: YouTubeUploadResult[] = [];
  for (const videoFile of videoFiles) {
    const videoPath = resolve(videosDir, videoFile);
    const metadataPath = videoPath.replace(".mp4", ".json");

    try {
      const result = await uploadVideoWithMetadata(videoPath, metadataPath);
      results.push(result);
    } catch (error) {
      console.error(`Failed to upload ${videoFile}:`, error);
      // Continue with other files
    }
  }

  console.log(`\n✓ Upload complete!`);
  console.log(`  Uploaded ${results.length} of ${videoFiles.length} videos`);

  console.warn(`\n⚠ Note: This is a stub implementation`);
  console.warn(`  Full YouTube upload requires:`);
  console.warn(`  - googleapis npm package`);
  console.warn(`  - YouTube Data API v3 credentials (OAuth 2.0)`);
  console.warn(`  - YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN environment variables`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadToYouTube().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { uploadToYouTube, uploadVideoWithMetadata };
