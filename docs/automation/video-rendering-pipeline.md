# Screeps Video Rendering Pipeline

The video rendering pipeline automates the capture of Screeps room history and generates time-lapse videos showcasing bot gameplay progression. Videos can optionally be uploaded to YouTube for community engagement and documentation.

## Overview

The pipeline consists of three main stages:

1. **Room History Capture** - Fetch replay data from Screeps API
2. **Video Rendering** - Convert replay data into time-lapse videos with overlays
3. **YouTube Upload** - Upload generated videos to YouTube channel (optional)

## Current Implementation Status

**⚠️ This is a stub implementation providing the infrastructure foundation.**

The following components are **implemented**:

- ✅ Configuration system for video pipeline settings
- ✅ Room history capture script (requires Screeps API integration)
- ✅ Video rendering script structure (stub)
- ✅ YouTube upload script structure (stub)
- ✅ GitHub Actions workflow orchestration
- ✅ Directory structure and storage management

The following components are **not yet implemented**:

- ❌ Frame extraction from Screeps replay data
- ❌ Actual video encoding with ffmpeg
- ❌ Overlay rendering (tick counter, timestamps, etc.)
- ❌ YouTube Data API v3 integration
- ❌ OAuth 2.0 authentication for YouTube

## Configuration

### Configuration File

Create `config/video-pipeline.json` based on the example:

```bash
cp config/video-pipeline.example.json config/video-pipeline.json
```

Edit the configuration to specify:

- **rooms**: Array of room names to record (e.g., `["W7N3", "E5S8"]`)
- **shard**: Target shard (default: `"shard3"`)
- **timeWindow**: Time range for capture (e.g., `"24h"`, `"7d"`)
- **rendering**: Video quality settings (resolution, FPS, codec)
- **overlays**: What information to display on video
- **youtube**: YouTube upload settings (if enabled)

### Environment Variables

The pipeline supports environment variable overrides:

**Screeps API:**

- `SCREEPS_TOKEN` - Screeps API authentication token (required)
- `SCREEPS_HOST` - Screeps server host (default: `screeps.com`)
- `SCREEPS_SHARD` - Target shard (default: `shard3`)

**Video Settings:**

- `VIDEO_ROOMS` - Comma-separated list of rooms (overrides config)
- `VIDEO_TIME_WINDOW` - Time window for capture (overrides config)
- `VIDEO_WIDTH` - Video width in pixels
- `VIDEO_HEIGHT` - Video height in pixels
- `VIDEO_FPS` - Frames per second

**YouTube API:**

- `YOUTUBE_ENABLED` - Enable YouTube upload (`true`/`false`)
- `YOUTUBE_CLIENT_ID` - YouTube OAuth client ID
- `YOUTUBE_CLIENT_SECRET` - YouTube OAuth client secret
- `YOUTUBE_REFRESH_TOKEN` - YouTube OAuth refresh token

## GitHub Actions Workflow

### Workflow File

`.github/workflows/screeps-video-render.yml`

### Trigger Conditions

**Manual Dispatch:**

```bash
# Via GitHub UI or CLI
gh workflow run screeps-video-render.yml \
  -f rooms="W7N3,E5S8" \
  -f time_window="24h" \
  -f upload_youtube=true
```

**Scheduled:**

- Runs weekly on Sunday at 00:00 UTC
- Automatically captures last 24 hours of gameplay

**Milestone Events:** (Future)

- RCL upgrade events
- Territory expansion
- Combat achievements

### Workflow Jobs

1. **capture-history** - Fetch room replay data from Screeps API
2. **render-video** - Generate time-lapse videos from replay data
3. **upload-youtube** - Upload videos to YouTube (optional, if enabled)
4. **summary** - Generate workflow execution summary

### Artifacts

Generated artifacts are stored for 30 days:

- **replay-data** - Raw Screeps replay JSON files (7 days)
- **rendered-videos** - Generated MP4 videos with metadata (30 days)

## Local Development

### Running Scripts Manually

**Capture room history:**

```bash
export SCREEPS_TOKEN="your-token"
export VIDEO_ROOMS="W7N3,E5S8"
npx tsx packages/utilities/scripts/capture-room-history.ts
```

**Render videos:**

```bash
npx tsx packages/utilities/scripts/render-room-video.ts
```

**Upload to YouTube:**

```bash
export YOUTUBE_ENABLED=true
export YOUTUBE_CLIENT_ID="your-client-id"
export YOUTUBE_CLIENT_SECRET="your-secret"
export YOUTUBE_REFRESH_TOKEN="your-refresh-token"
npx tsx packages/utilities/scripts/upload-to-youtube.ts
```

## Required Dependencies (Not Yet Added)

To complete the implementation, the following dependencies are required:

### System Packages

```bash
sudo apt-get install ffmpeg
```

### npm Packages

```bash
yarn add googleapis fluent-ffmpeg @types/fluent-ffmpeg
```

### Optional: Frame Rendering

For rendering Screeps room visuals from replay data:

- **screeps-world-printer** - Render Screeps world maps as PNG
- **node-canvas** - Canvas API for Node.js
- **puppeteer** - Headless browser for screenshot capture

## YouTube API Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable YouTube Data API v3

### 2. Create OAuth Credentials

1. Navigate to APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Desktop app)
3. Download credentials JSON

### 3. Generate Refresh Token

Use OAuth playground or a setup script to generate refresh token:

```javascript
// Example OAuth flow (requires googleapis)
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/youtube.upload"]
});

// After user authorization, exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);
console.log("Refresh Token:", tokens.refresh_token);
```

### 4. Configure Secrets

Add to GitHub repository secrets:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

## Implementation Roadmap

### Phase 1: Core Infrastructure ✅

- [x] Configuration system
- [x] Script structure and CLI
- [x] GitHub Actions workflow
- [x] Documentation

### Phase 2: Frame Extraction (Not Yet Implemented)

- [ ] Integrate screeps-world-printer or equivalent
- [ ] Implement frame-by-frame replay rendering
- [ ] Add overlay rendering (tick, timestamp, version)
- [ ] Support different rendering modes (room visual, terrain only, etc.)

### Phase 3: Video Encoding (Not Yet Implemented)

- [ ] Add ffmpeg integration with fluent-ffmpeg
- [ ] Implement video encoding with configurable quality
- [ ] Add progress tracking and error handling
- [ ] Support multiple output formats (MP4, WebM)

### Phase 4: YouTube Integration (Not Yet Implemented)

- [ ] Add googleapis dependency
- [ ] Implement OAuth 2.0 authentication
- [ ] Implement video upload with metadata
- [ ] Add playlist management
- [ ] Implement upload queue and rate limiting

### Phase 5: Advanced Features (Future)

- [ ] Milestone-based automatic video generation
- [ ] Multi-room compilation videos
- [ ] Audio overlay (music, narration)
- [ ] Interactive annotations
- [ ] Thumbnail generation
- [ ] Social media sharing integration

## Testing

### Unit Tests

Test configuration loading and metadata generation:

```bash
yarn test:unit packages/utilities/scripts/lib/video-config.test.ts
```

### Integration Tests

Test full pipeline with sample replay data:

```bash
# Generate sample replay data
npx tsx packages/utilities/scripts/generate-test-snapshots.ts

# Run pipeline
export SCREEPS_TOKEN="test-token"
npx tsx packages/utilities/scripts/capture-room-history.ts
npx tsx packages/utilities/scripts/render-room-video.ts
```

## Troubleshooting

### No Replay Data Captured

**Problem:** `capture-room-history.ts` completes but no files generated

**Solutions:**

- Verify `VIDEO_ROOMS` environment variable is set
- Check `SCREEPS_TOKEN` is valid and has API access
- Confirm rooms exist and have history available
- Check Screeps API rate limits

### Video Rendering Fails

**Problem:** `render-room-video.ts` fails with missing dependencies

**Solutions:**

- Install ffmpeg: `sudo apt-get install ffmpeg`
- Install npm dependencies: `yarn add fluent-ffmpeg`
- Verify frame extraction implementation is complete

### YouTube Upload Fails

**Problem:** `upload-to-youtube.ts` fails with authentication errors

**Solutions:**

- Verify all YouTube credentials are configured
- Check OAuth token has not expired
- Ensure YouTube Data API v3 is enabled
- Verify account has upload permissions

## Related Documentation

- [Screeps API Documentation](https://docs.screeps.com/api/)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [ffmpeg Documentation](https://ffmpeg.org/documentation.html)
- [fluent-ffmpeg npm package](https://www.npmjs.com/package/fluent-ffmpeg)

## Support

For issues or questions:

1. Check [GitHub Issues](https://github.com/ralphschuler/.screeps-gpt/issues)
2. Review implementation status above
3. Consult related documentation links
4. Open a new issue with details

---

**Implementation Status:** 🚧 Infrastructure Complete, Core Features Pending

This pipeline provides the foundation for automated video content generation. The remaining implementation requires additional dependencies and integration work as outlined in the roadmap above.
